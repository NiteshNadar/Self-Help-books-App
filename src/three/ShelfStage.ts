import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COPIES, FILM_COUNT, FILMS, INITIAL_SCROLL, TOTAL_TAPES } from '../lib/films';
import {
  computePlayRingScale,
  computeTapeTransform,
  expDamp,
  filmIndexFromScroll,
  normalizeScrollLoop,
  shortestLoopTarget,
  wrapRelativeIndex,
  type ScreenRect,
} from '../lib/shelfMath';
import { createFilmTextureBundle, type TextureBundle } from './textures';
import {
  createSharedVHSResources,
  createVHSTapeInstance,
  NORM_D,
  NORM_GAP,
  NORM_H,
  NORM_WS,
  type SharedVHSResources,
  type VHSTapeInstance,
} from './vhsModel';

export type CursorMode = 'default' | 'spine' | 'btn' | 'open';

export interface ShelfCallbacks {
  onActiveFilmChange: (filmIndex: number, dir: number) => void;
  onOpenDetail: (filmIndex: number, coverRect: ScreenRect) => void;
  onPlayRingUpdate: (x: number, y: number, scale: number) => void;
  onCursorUpdate: (x: number, y: number, mode: CursorMode, visible: boolean) => void;
  onMetricsUpdate: (H: number, ws: number, d: number) => void;
}

const _corner = new THREE.Vector3();
const _ndcMouse = new THREE.Vector2();
const _baseColor = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class ShelfStage {
  private container: HTMLElement;
  private callbacks: ShelfCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envRT: THREE.WebGLRenderTarget;
  private textures: TextureBundle;
  private shared: SharedVHSResources;
  private tapes: VHSTapeInstance[] = [];
  private hitProxies: THREE.Mesh[] = [];
  private raycaster: THREE.Raycaster;

  // Viewport & CSS-matched --H metrics
  private vpW = 1440;
  private vpH = 900;
  private Hpx = 414;
  private wsPx = 70;
  private dPx = 218;
  private gapPx = 12.4;

  // Motion state
  public s = INITIAL_SCROLL;
  public T = INITIAL_SCROLL;
  private activeFilmIndex = filmIndexFromScroll(INITIAL_SCROLL);
  private hoveredVirtual = -1;
  private isOpen = false;
  private reducedMotion = false;

  // Pointer & tilt state
  private hasPointer = false;
  private mx = 0;
  private my = 0;
  private cx = 0;
  private cy = 0;
  private tiltX = 0;
  private tiltY = 0;
  private onCover = false;
  private overButton = false;

  // Drag & wheel state
  private dragging = false;
  private dragMoved = false;
  private dragPointerId = -1;
  private dragStartX = 0;
  private dragStartT = INITIAL_SCROLL;
  private wheelSnapTimer: number | null = null;
  private lastRaycastTime = 0;

  // Loop & scheduling state
  private disposed = false;
  private loopRunning = false;
  private renderBusy = false;
  private needsFrame = false;
  private rafId = 0;
  private timerId = 0;
  private lastFrameTime = 0;

  private probeEl: HTMLDivElement;

  constructor(container: HTMLElement, callbacks: ShelfCallbacks, initialFilmIndex?: number) {
    this.container = container;
    this.callbacks = callbacks;

    if (typeof initialFilmIndex === 'number' && initialFilmIndex >= 0 && initialFilmIndex < FILM_COUNT) {
      this.s = initialFilmIndex + FILM_COUNT;
      this.T = this.s;
      this.activeFilmIndex = initialFilmIndex;
    }

    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.isSoftwareGl = detectSoftwareWebGL();

    // Off-screen probe element to measure the exact CSS --H token
    this.probeEl = document.createElement('div');
    this.probeEl.style.position = 'fixed';
    this.probeEl.style.visibility = 'hidden';
    this.probeEl.style.pointerEvents = 'none';
    this.probeEl.style.height = 'var(--H)';
    this.probeEl.style.width = '1px';
    this.probeEl.style.top = '-9999px';
    document.body.appendChild(this.probeEl);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const dom = this.renderer.domElement;
    dom.style.width = '100%';
    dom.style.height = '100%';
    dom.style.display = 'block';
    dom.style.touchAction = 'pan-y';
    dom.setAttribute('data-testid', 'vhs-shelf-canvas');
    this.container.appendChild(dom);

    // Scene & Studio Environment
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.28;
    pmrem.dispose();

    // Camera (aligned to CSS perspective: 2200px)
    this.camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.1, 100);

    // Warm/cool 3-point studio lighting calibrated for crisp print artwork
    const hemi = new THREE.HemisphereLight(0xf2f5ff, 0xe8e0d2, 1.35);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff8ec, 1.85);
    keyLight.position.set(-2.2, 3.0, 6.5);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 16;
      keyLight.shadow.camera.left = -4;
      keyLight.shadow.camera.right = 4;
      keyLight.shadow.camera.top = 2;
      keyLight.shadow.camera.bottom = -2;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdce6ff, 0.6);
    rimLight.position.set(3.2, 2.0, -3.0);
    this.scene.add(rimLight);

    // Textures & 36 composite VHS tape instances (3 full copies of the 12 films)
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createFilmTextureBundle(maxAniso, () => {
      this.wake();
    });
    this.shared = createSharedVHSResources(this.textures);

    for (let copy = 0; copy < COPIES; copy++) {
      for (let i = 0; i < FILM_COUNT; i++) {
        const v = copy * FILM_COUNT + i;
        const film = FILMS[i];
        const inst = createVHSTapeInstance(
          v,
          i,
          film.id,
          this.shared,
          this.textures,
          !this.isSoftwareGl
        );
        this.tapes.push(inst);
        this.hitProxies.push(inst.hitProxy);
        this.scene.add(inst.group);
      }
    }

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(1);

    this.mx = window.innerWidth * 0.5;
    this.my = window.innerHeight * 0.5;
    this.cx = this.mx;
    this.cy = this.my;

    this.measureAndResize();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.updateSceneTransforms(0.016);
    this.renderFrame();
    this.wake();
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('pointercancel', this.onWindowPointerUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    this.renderer.domElement.addEventListener('pointerdown', this.onCanvasPointerDown);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private onResize = () => {
    this.measureAndResize();
    this.updateSceneTransforms(0.016);
    this.wake();
  };

  private measureAndResize() {
    this.vpW = Math.max(1, window.innerWidth);
    this.vpH = Math.max(1, window.innerHeight);

    const measuredH = this.probeEl.getBoundingClientRect().height;
    this.Hpx = measuredH > 40 ? measuredH : Math.min(this.vpH * 0.46, this.vpW * 0.31);
    this.wsPx = (this.Hpx * 142) / 840;
    this.dPx = (this.Hpx * 474) / 900;
    this.gapPx = this.Hpx * 0.03;

    // Match CSS perspective: 2200px so 1 world unit == Hpx CSS pixels at z = 0
    const perspectivePx = 2200;
    const cameraZ = perspectivePx / this.Hpx;
    const fovRad = 2 * Math.atan(this.vpH / 2 / perspectivePx);
    this.camera.fov = THREE.MathUtils.radToDeg(fovRad);
    this.camera.aspect = this.vpW / this.vpH;
    this.camera.position.set(0, 0, cameraZ);
    this.camera.near = Math.max(0.1, cameraZ - 4);
    this.camera.far = cameraZ + 18;
    this.camera.updateProjectionMatrix();

    // Horizon-matched paper fog
    this.scene.fog = new THREE.Fog(0xedebe6, cameraZ + 3.0, cameraZ + 14.0);

    this.renderer.setSize(this.vpW, this.vpH, false);
    this.callbacks.onMetricsUpdate(this.Hpx, this.wsPx, this.dPx);
  }

  public setDetailOpen(open: boolean) {
    this.isOpen = open;
    this.overButton = false;
    if (open) {
      this.T = Math.round(this.T);
      this.hoveredVirtual = -1;
      this.onCover = false;
    }
    if (this.hasPointer && typeof document.elementFromPoint === 'function') {
      const el = document.elementFromPoint(this.mx, this.my) as HTMLElement | null;
      this.overButton = Boolean(el && el.closest('button, a'));
    }
    this.wake();
  }

  public stepBy(delta: number) {
    if (this.isOpen) return;
    this.T = Math.round(this.T) + delta;
    this.wake();
  }

  public jumpToFilmIndex(filmIndex: number) {
    if (this.isOpen) return;
    this.T = shortestLoopTarget(this.T, filmIndex, FILM_COUNT);
    this.wake();
  }

  public getActiveFilmIndex(): number {
    return this.activeFilmIndex;
  }

  /**
   * Computes the exact screen-space bounding rect of the active tape's front cover face
   * by projecting its 4 corners through the Three.js PerspectiveCamera.
   */
  public getActiveCoverRect(): ScreenRect {
    const activeTape = this.findNearestActiveTape();
    if (activeTape) {
      activeTape.group.updateMatrixWorld(true);
      const hw = NORM_D * 0.5;
      const hh = NORM_H * 0.5;
      const faceX = NORM_WS * 0.5 + 0.0008;

      // Corners of the cover face in tape local space (cover plane sits on +X face)
      const localCorners: Array<[number, number, number]> = [
        [faceX, hh, hw],
        [faceX, hh, -hw],
        [faceX, -hh, hw],
        [faceX, -hh, -hw],
      ];

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const [lx, ly, lz] of localCorners) {
        _corner.set(lx, ly, lz).applyMatrix4(activeTape.group.matrixWorld).project(this.camera);
        const sx = (_corner.x * 0.5 + 0.5) * this.vpW;
        const sy = (-_corner.y * 0.5 + 0.5) * this.vpH;
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
      }

      if (Number.isFinite(minX) && maxX > minX && maxY > minY) {
        return {
          left: minX,
          top: minY,
          right: maxX,
          bottom: maxY,
          width: maxX - minX,
          height: maxY - minY,
        };
      }
    }

    // Fallback centered cover rect
    const w = this.dPx * 1.05;
    const h = this.Hpx * 1.05;
    const left = (this.vpW - w) * 0.5;
    const top = (this.vpH - h) * 0.5;
    return { left, top, right: left + w, bottom: top + h, width: w, height: h };
  }

  private findNearestActiveTape(): VHSTapeInstance | null {
    let best: VHSTapeInstance | null = null;
    let bestDist = Infinity;
    for (const tape of this.tapes) {
      const r = Math.abs(wrapRelativeIndex(tape.virtualIndex, this.s, TOTAL_TAPES));
      if (r < bestDist) {
        bestDist = r;
        best = tape;
      }
    }
    return best;
  }

  private raycastTapeAt(clientX: number, clientY: number): VHSTapeInstance | null {
    _ndcMouse.x = (clientX / this.vpW) * 2 - 1;
    _ndcMouse.y = -(clientY / this.vpH) * 2 + 1;
    this.raycaster.setFromCamera(_ndcMouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitProxies, false);
    if (hits.length === 0) return null;
    const v = hits[0].object.userData.virtualIndex as number;
    return this.tapes[v] ?? null;
  }

  private onCanvasPointerDown = (e: PointerEvent) => {
    if (this.isOpen) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    this.dragging = true;
    this.dragMoved = false;
    this.dragPointerId = e.pointerId;
    this.dragStartX = e.clientX;
    this.dragStartT = this.T;
    this.mx = e.clientX;
    this.my = e.clientY;
    this.hasPointer = true;

    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic pointer events without active pointerId
    }
    this.wake();
  };

  private onWindowPointerMove = (e: PointerEvent) => {
    this.mx = e.clientX;
    this.my = e.clientY;
    this.hasPointer = true;

    const target = e.target as HTMLElement | null;
    this.overButton = Boolean(target && target.closest('button, a'));

    if (this.dragging && e.pointerId === this.dragPointerId) {
      const dx = e.clientX - this.dragStartX;
      if (Math.abs(dx) > 5) {
        this.dragMoved = true;
      }
      if (this.dragMoved) {
        this.T = this.dragStartT - dx / (this.wsPx + this.gapPx);
        this.hoveredVirtual = -1;
      }
      this.wake();
      return;
    }

    if (!this.isOpen && !this.overButton) {
      const now = performance.now();
      if (now - this.lastRaycastTime >= 24) {
        this.lastRaycastTime = now;
        const hit = this.raycastTapeAt(e.clientX, e.clientY);
        this.hoveredVirtual = hit ? hit.virtualIndex : -1;
      }
    } else {
      this.hoveredVirtual = -1;
    }

    this.wake();
  };

  private onWindowPointerUp = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.dragPointerId) return;

    const wasDrag = this.dragMoved;
    this.dragging = false;
    this.dragMoved = false;

    try {
      if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (wasDrag) {
      this.T = Math.round(this.T);
      this.wake();
      return;
    }

    // Treat as a click on the shelf
    if (!this.isOpen) {
      const hit = this.raycastTapeAt(e.clientX, e.clientY);
      if (hit) {
        const r = wrapRelativeIndex(hit.virtualIndex, this.s, TOTAL_TAPES);
        if (Math.abs(r) < 0.5) {
          this.T = Math.round(this.T);
          this.callbacks.onOpenDetail(hit.filmIndex, this.getActiveCoverRect());
        } else {
          this.T = Math.round(this.T + r);
        }
        this.wake();
      }
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.isOpen) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 0.1) return;

    e.preventDefault();
    this.T += (delta / (this.wsPx + this.gapPx)) * 0.5;

    if (this.wheelSnapTimer !== null) {
      window.clearTimeout(this.wheelSnapTimer);
    }
    this.wheelSnapTimer = window.setTimeout(() => {
      this.T = Math.round(this.T);
      this.wheelSnapTimer = null;
      this.wake();
    }, 160);

    this.wake();
  };

  /**
   * Advances spring physics, hover lift, cursor tilt, play ring, and 3D tape transforms.
   * Returns true if any animation is still in progress and requires another frame.
   */
  private updateSceneTransforms(dt: number): boolean {
    let activeMotion = false;

    // 1. Scroll spring
    const springK = this.dragging ? 18 : 5.2;
    if (this.reducedMotion) {
      this.s = this.T;
    } else {
      const prevS = this.s;
      this.s = expDamp(this.s, this.T, springK, dt, 1e-4);
      if (Math.abs(this.T - this.s) > 1e-4 || Math.abs(this.s - prevS) > 1e-5) {
        activeMotion = true;
      }
    }

    // 2. Normalize scroll loops beyond ±4 full loops
    const norm = normalizeScrollLoop(this.s, this.T, FILM_COUNT, 4);
    this.s = norm.s;
    this.T = norm.T;

    // 3. Active film caption change detection
    const nextFilm = filmIndexFromScroll(this.s, FILM_COUNT);
    if (nextFilm !== this.activeFilmIndex) {
      const dir = this.T - this.s >= 0 ? 1 : -1;
      this.activeFilmIndex = nextFilm;
      this.callbacks.onActiveFilmChange(nextFilm, dir);
    }

    // 4. Cursor exponential smoothing & cover hit test
    const shelfCy = this.vpH * 0.5;
    const onCoverNow =
      !this.isOpen &&
      !this.overButton &&
      this.hasPointer &&
      Math.abs(this.mx - this.vpW * 0.5) < 0.55 * this.dPx &&
      Math.abs(this.my - shelfCy) < 0.55 * this.Hpx &&
      Math.abs(this.T - this.s) < 0.3;
    this.onCover = onCoverNow;

    const prevCx = this.cx;
    const prevCy = this.cy;
    if (this.reducedMotion) {
      this.cx = this.mx;
      this.cy = this.my;
    } else {
      this.cx = expDamp(this.cx, this.mx, 16, dt, 0.15);
      this.cy = expDamp(this.cy, this.my, 16, dt, 0.15);
      if (Math.abs(this.cx - prevCx) > 0.1 || Math.abs(this.cy - prevCy) > 0.1) {
        activeMotion = true;
      }
    }

    let cursorMode: CursorMode = 'default';
    if (this.overButton) {
      cursorMode = 'btn';
    } else if (this.onCover) {
      cursorMode = 'open';
    } else if (!this.isOpen && this.hoveredVirtual !== -1) {
      const hr = wrapRelativeIndex(this.hoveredVirtual, this.s, TOTAL_TAPES);
      if (Math.abs(hr) > 0.5) {
        cursorMode = 'spine';
      }
    }
    this.callbacks.onCursorUpdate(this.cx, this.cy, cursorMode, this.hasPointer);

    // 5. Cover cursor tilt
    let targetTiltY = 0;
    let targetTiltX = 0;
    if (this.hasPointer && !this.isOpen) {
      if (this.onCover) {
        targetTiltY = ((this.mx - this.vpW * 0.5) / (0.55 * this.dPx)) * 9;
        targetTiltX = -((this.my - shelfCy) / (this.Hpx * 0.5)) * 6;
      } else {
        targetTiltY = ((this.mx - this.vpW * 0.5) / this.vpW) * 5;
        targetTiltX = 0;
      }
    }
    if (this.reducedMotion) {
      this.tiltX = targetTiltX;
      this.tiltY = targetTiltY;
    } else {
      const prevTx = this.tiltX;
      const prevTy = this.tiltY;
      this.tiltX = expDamp(this.tiltX, targetTiltX, 7, dt, 1e-3);
      this.tiltY = expDamp(this.tiltY, targetTiltY, 7, dt, 1e-3);
      if (Math.abs(this.tiltX - prevTx) > 1e-3 || Math.abs(this.tiltY - prevTy) > 1e-3) {
        activeMotion = true;
      }
    }

    // 6. Update all 36 tape 3D transforms, hover lifts, and shading
    const normMetrics = { H: NORM_H, ws: NORM_WS, d: NORM_D, gap: NORM_GAP };
    const halfWidthWorld = (this.vpW * 0.5) / this.Hpx;

    for (let i = 0; i < this.tapes.length; i++) {
      const tape = this.tapes[i];
      const r = wrapRelativeIndex(tape.virtualIndex, this.s, TOTAL_TAPES);
      const isHoveredSpine =
        !this.isOpen && !this.dragging && this.hoveredVirtual === tape.virtualIndex && Math.abs(r) > 0.5;
      const liftTarget = isHoveredSpine ? 1 : 0;

      if (this.reducedMotion) {
        tape.lift = liftTarget;
      } else {
        const prevLift = tape.lift;
        tape.lift = expDamp(tape.lift, liftTarget, 12, dt, 1e-3);
        if (Math.abs(tape.lift - prevLift) > 1e-4) {
          activeMotion = true;
        }
      }

      const tf = computeTapeTransform(
        r,
        normMetrics,
        halfWidthWorld,
        tape.lift,
        this.tiltX,
        this.tiltY
      );

      tape.group.visible = tf.visible;
      if (!tf.visible) continue;

      // Convert CSS Y-down to Three.js Y-up:
      //  - CSS translateY(-o*0.025*H - lift*0.045*H) => Three.js position.y = +o*0.025 + lift*0.045
      //  - CSS rotateZ(-4.5deg * o) anticlockwise    => Three.js rotation.z = +4.5deg * o
      //  - CSS rotateY(-90deg * o + tiltY * o)       => Three.js rotation.y = -90deg * o + tiltY * o
      //  - Tilt X looks toward pointer vertically    => Three.js rotation.x = -tiltX * o
      tape.group.position.set(tf.x, -tf.y, tf.z);
      tape.group.rotation.set(
        THREE.MathUtils.degToRad(-tf.rotXDeg),
        THREE.MathUtils.degToRad(tf.rotYDeg),
        THREE.MathUtils.degToRad(-tf.rotZDeg)
      );

      // Apply authentic turning shade to spine and cover materials
      const spineLit = 1 - tf.spineShade;
      const coverLit = 1 - tf.coverShade;
      _baseColor.setRGB(spineLit, spineLit, spineLit);
      tape.spineMat.color.copy(_baseColor);
      _baseColor.setRGB(coverLit, coverLit, coverLit);
      tape.coverMat.color.copy(_baseColor);

      // Soft drop shadow cast onto paper sheet behind the pulled-out cover
      tape.shadowMat.opacity = tf.o * 0.88;
      tape.shadowMesh.visible = tf.o > 0.02;
    }

    // 7. Play ring position and pop-in scale
    const playScale = computePlayRingScale(this.T, this.s, this.isOpen);
    const playX = this.vpW * 0.5 - 0.5 * this.dPx - 6;
    const playY = shelfCy + 0.36 * this.Hpx;
    this.callbacks.onPlayRingUpdate(playX, playY, playScale);

    return activeMotion;
  }

  private renderFrame() {
    this.renderer.render(this.scene, this.camera);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          this.timerId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.timerId = window.setTimeout(cb, 80);
        }
      };
      this.timerId = window.setTimeout(poll, 5);
    } else {
      this.timerId = window.setTimeout(cb, 80);
    }
  }

  public wake() {
    if (this.disposed) return;
    this.needsFrame = true;
    if (this.loopRunning || this.renderBusy) return;
    this.loopRunning = true;
    this.lastFrameTime = performance.now();
    this.scheduleNextTick();
  }

  private scheduleNextTick() {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    const maxDt = this.isSoftwareGl ? 0.25 : 0.05;
    const dt = Math.min(maxDt, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    this.needsFrame = false;

    const stillMoving = this.updateSceneTransforms(dt);
    this.renderBusy = true;
    this.renderFrame();

    const finish = () => {
      this.renderBusy = false;
      if (this.disposed) return;
      if (stillMoving || this.needsFrame) {
        this.scheduleNextTick();
      } else {
        this.loopRunning = false;
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(finish);
    } else {
      finish();
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.clearTimeout(this.timerId);
    if (this.wheelSnapTimer !== null) {
      window.clearTimeout(this.wheelSnapTimer);
    }

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    window.removeEventListener('pointerup', this.onWindowPointerUp);
    window.removeEventListener('pointercancel', this.onWindowPointerUp);
    window.removeEventListener('wheel', this.onWheel);
    this.renderer.domElement.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);

    for (const tape of this.tapes) {
      tape.dispose();
    }
    this.shared.dispose();
    this.textures.dispose();
    this.envRT.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    if (this.probeEl.parentElement) {
      this.probeEl.parentElement.removeChild(this.probeEl);
    }
  }
}
