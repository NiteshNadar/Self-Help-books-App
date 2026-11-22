import * as THREE from 'three';
import type { TextureBundle } from './textures';

export interface SharedVHSResources {
  slipcaseGeo: THREE.BufferGeometry;
  spinePlaneGeo: THREE.PlaneGeometry;
  coverPlaneGeo: THREE.PlaneGeometry;
  topCapGeo: THREE.BoxGeometry;
  cassetteBodyGeo: THREE.BoxGeometry;
  reelWindowGeo: THREE.BoxGeometry;
  guidePinGeo: THREE.CylinderGeometry;
  shadowPlaneGeo: THREE.PlaneGeometry;
  hitProxyGeo: THREE.BoxGeometry;

  cardboardMat: THREE.MeshStandardMaterial;
  backCoverMat: THREE.MeshStandardMaterial;
  cassetteAbsMat: THREE.MeshStandardMaterial;
  reelWindowMat: THREE.MeshPhysicalMaterial;
  guidePinMat: THREE.MeshStandardMaterial;
  hitProxyMat: THREE.MeshBasicMaterial;

  dispose: () => void;
}

export interface VHSTapeInstance {
  virtualIndex: number;
  filmIndex: number;
  filmId: string;
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  spineMat: THREE.MeshStandardMaterial;
  coverMat: THREE.MeshStandardMaterial;
  shadowMesh: THREE.Mesh;
  shadowMat: THREE.MeshBasicMaterial;
  lift: number;
  dispose: () => void;
}

// Normalized dimensions (H = 1.0 world unit)
export const NORM_H = 1.0;
export const NORM_WS = 142 / 840; // ~0.16905
export const NORM_D = 474 / 900;  // ~0.52667
export const NORM_GAP = 0.03;

function createBeveledSlipcaseGeometry(ws: number, h: number, d: number): THREE.ExtrudeGeometry {
  // Cross-section in XY (width = ws, depth = d), extruded along height with subtle worn-cardboard bevel
  const r = 0.006;
  const hw = ws * 0.5 - 0.003;
  const hd = d * 0.5 - 0.003;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const bevelSize = 0.003;
  const extrudeDepth = h - bevelSize * 2 - 0.008;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 4,
  });

  // Rotate so extrusion runs vertically along Y and center at origin
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}

export function createSharedVHSResources(textures: TextureBundle): SharedVHSResources {
  const slipcaseGeo = createBeveledSlipcaseGeometry(NORM_WS, NORM_H, NORM_D);
  const spinePlaneGeo = new THREE.PlaneGeometry(NORM_WS, NORM_H, 1, 1);
  const coverPlaneGeo = new THREE.PlaneGeometry(NORM_D, NORM_H, 1, 1);
  const topCapGeo = new THREE.BoxGeometry(NORM_WS * 0.92, 0.007, NORM_D * 0.94);
  const cassetteBodyGeo = new THREE.BoxGeometry(NORM_WS * 0.72, 0.018, NORM_D * 0.84);
  const reelWindowGeo = new THREE.BoxGeometry(NORM_WS * 0.75, 0.01, NORM_D * 0.22);
  const guidePinGeo = new THREE.CylinderGeometry(0.006, 0.006, NORM_WS * 0.76, 12);
  guidePinGeo.rotateZ(Math.PI / 2);
  const shadowPlaneGeo = new THREE.PlaneGeometry(NORM_D * 1.44, NORM_H * 1.28);
  const hitProxyGeo = new THREE.BoxGeometry(NORM_WS * 1.04, NORM_H * 1.02, NORM_D * 1.04);

  // Matte archival cream cardboard body (roughness 0.88)
  const cardboardMat = new THREE.MeshStandardMaterial({
    color: 0xe8e4db,
    roughness: 0.88,
    metalness: 0.0,
    bumpMap: textures.cardboardBump,
    bumpScale: 0.003,
  });

  // Back cardboard lip trim (slightly darker warm linen stock)
  const backCoverMat = new THREE.MeshStandardMaterial({
    color: 0xd2cbc0,
    roughness: 0.9,
    metalness: 0.0,
    bumpMap: textures.cardboardBump,
    bumpScale: 0.0025,
  });

  // Matte black ABS inner VHS cassette shell (roughness 0.42 -> >=0.40 contrast vs cardboard)
  const cassetteAbsMat = new THREE.MeshStandardMaterial({
    color: 0x1a1918,
    roughness: 0.42,
    metalness: 0.08,
  });

  // Glossy smoked acrylic tape window accent (roughness 0.14)
  const reelWindowMat = new THREE.MeshPhysicalMaterial({
    color: 0x262930,
    roughness: 0.14,
    metalness: 0.12,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });

  // Brushed metallic cassette guide pin accent (metalness 0.88, roughness 0.24)
  const guidePinMat = new THREE.MeshStandardMaterial({
    color: 0xc8ccd4,
    roughness: 0.24,
    metalness: 0.88,
  });

  const hitProxyMat = new THREE.MeshBasicMaterial({
    visible: false,
  });

  return {
    slipcaseGeo,
    spinePlaneGeo,
    coverPlaneGeo,
    topCapGeo,
    cassetteBodyGeo,
    reelWindowGeo,
    guidePinGeo,
    shadowPlaneGeo,
    hitProxyGeo,
    cardboardMat,
    backCoverMat,
    cassetteAbsMat,
    reelWindowMat,
    guidePinMat,
    hitProxyMat,
    dispose: () => {
      slipcaseGeo.dispose();
      spinePlaneGeo.dispose();
      coverPlaneGeo.dispose();
      topCapGeo.dispose();
      cassetteBodyGeo.dispose();
      reelWindowGeo.dispose();
      guidePinGeo.dispose();
      shadowPlaneGeo.dispose();
      hitProxyGeo.dispose();
      cardboardMat.dispose();
      backCoverMat.dispose();
      cassetteAbsMat.dispose();
      reelWindowMat.dispose();
      guidePinMat.dispose();
      hitProxyMat.dispose();
    },
  };
}

/**
 * Assembles a composite 6-part procedural VHS slipcase + recessed inner cassette THREE.Group.
 * Local orientation matches the Leon Vasari 3D cuboid:
 *  - Spine artwork sits on the +Z front face (z = +NORM_D / 2)
 *  - Cover artwork sits on the +X right face (x = +NORM_WS / 2, rotated +90deg Y)
 *  - Rotating the group by -90deg around Y turns the illustrated front cover to face +Z (the viewer).
 */
export function createVHSTapeInstance(
  virtualIndex: number,
  filmIndex: number,
  filmId: string,
  shared: SharedVHSResources,
  textures: TextureBundle,
  enableShadows: boolean
): VHSTapeInstance {
  const group = new THREE.Group();
  group.rotation.order = 'ZXY';

  const texPair = textures.byFilmId.get(filmId)!;

  // Part 1: Beveled outer cardboard slipcase body
  const slipcaseMesh = new THREE.Mesh(shared.slipcaseGeo, shared.cardboardMat);
  slipcaseMesh.castShadow = enableShadows;
  slipcaseMesh.receiveShadow = enableShadows;
  group.add(slipcaseMesh);

  // Part 2: Illustrated Spine Face (+Z)
  const spineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texPair.spine,
    roughness: 0.78,
    metalness: 0.02,
    bumpMap: textures.cardboardBump,
    bumpScale: 0.0018,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const spineMesh = new THREE.Mesh(shared.spinePlaneGeo, spineMat);
  spineMesh.position.set(0, 0, NORM_D * 0.5 + 0.0008);
  group.add(spineMesh);

  // Part 3: Illustrated Front Cover Face (+X)
  const coverMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texPair.cover,
    roughness: 0.72,
    metalness: 0.02,
    bumpMap: textures.cardboardBump,
    bumpScale: 0.0016,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const coverMesh = new THREE.Mesh(shared.coverPlaneGeo, coverMat);
  coverMesh.position.set(NORM_WS * 0.5 + 0.0008, 0, 0);
  coverMesh.rotation.y = Math.PI / 2;
  group.add(coverMesh);

  // Part 4: Folded Top Cardboard Flap Lip (+Y)
  const topCapMesh = new THREE.Mesh(shared.topCapGeo, shared.backCoverMat);
  topCapMesh.position.set(0, NORM_H * 0.5 - 0.0015, 0);
  group.add(topCapMesh);

  // Part 5: Recessed Black VHS Cassette Shell + Acrylic Reel Window + Metallic Guide Pin (-Y opening)
  const cassetteGroup = new THREE.Group();
  cassetteGroup.position.set(0, -NORM_H * 0.5 + 0.014, 0);

  const cassetteBody = new THREE.Mesh(shared.cassetteBodyGeo, shared.cassetteAbsMat);
  cassetteGroup.add(cassetteBody);

  const reelWindow = new THREE.Mesh(shared.reelWindowGeo, shared.reelWindowMat);
  reelWindow.position.set(0, -0.002, 0.04);
  cassetteGroup.add(reelWindow);

  const guidePin = new THREE.Mesh(shared.guidePinGeo, shared.guidePinMat);
  guidePin.position.set(0, -0.001, -NORM_D * 0.28);
  cassetteGroup.add(guidePin);

  group.add(cassetteGroup);

  // Part 6: Soft radial paper drop-shadow plane cast behind the pulled-out cover
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.dropShadow,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shared.shadowPlaneGeo, shadowMat);
  // Placed slightly behind the -X back side of the tape so when turned to face +Z it sits behind the cover
  shadowMesh.position.set(-NORM_WS * 0.5 - 0.045, -0.045, -0.015);
  shadowMesh.rotation.y = Math.PI / 2;
  shadowMesh.renderOrder = -1;
  group.add(shadowMesh);

  // Simplified invisible collision proxy on raycast layer 1 for crisp pointer picking
  const hitProxy = new THREE.Mesh(shared.hitProxyGeo, shared.hitProxyMat);
  hitProxy.layers.set(1);
  hitProxy.userData = { virtualIndex, filmIndex };
  group.add(hitProxy);

  return {
    virtualIndex,
    filmIndex,
    filmId,
    group,
    hitProxy,
    spineMat,
    coverMat,
    shadowMesh,
    shadowMat,
    lift: 0,
    dispose: () => {
      spineMat.dispose();
      coverMat.dispose();
      shadowMat.dispose();
    },
  };
}
