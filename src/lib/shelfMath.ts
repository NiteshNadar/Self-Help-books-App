import { CROPS, FILM_COUNT, SHEETS, TOTAL_TAPES, type CropBox } from './films';

export interface ShelfMetrics {
  H: number;
  ws: number;
  d: number;
  gap: number;
}

export interface TapeTransformState {
  r: number;
  o: number;
  x: number;
  y: number;
  z: number;
  rotXDeg: number;
  rotYDeg: number;
  rotZDeg: number;
  spineShade: number;
  coverShade: number;
  zIndex: number;
  visible: boolean;
}

export interface PosterImageBox {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function smoothstep01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

export function computeTapeDimensions(H: number): ShelfMetrics {
  return {
    H,
    ws: (H * 142) / 840,
    d: (H * 474) / 900,
    gap: H * 0.03,
  };
}

/**
 * Wraps virtual index difference (v - s) modulo TOTAL_TAPES into [-TOTAL_TAPES/2, +TOTAL_TAPES/2).
 */
export function wrapRelativeIndex(v: number, s: number, total = TOTAL_TAPES): number {
  const half = total / 2;
  let r = ((v - s) % total + total) % total;
  if (r >= half) r -= total;
  return r;
}

/**
 * Smooth step function B(r) for opening gap around the active tape.
 */
export function smoothStepB(r: number): number {
  if (Math.abs(r) < 1) {
    return (r + Math.sin(Math.PI * r) / Math.PI) / 2;
  }
  return r < 0 ? -0.5 : 0.5;
}

/**
 * Horizontal center position x = F(r) in the same units as ws, d, gap.
 */
export function computeTapeX(r: number, ws: number, d: number, gap: number): number {
  return r * (ws + gap) + (d - ws + 1.6 * gap) * smoothStepB(r);
}

/**
 * Computes full 3D transform and shading values for a tape at relative index r.
 * Units of x, y, z match metrics (either pixels or normalized H=1 world units).
 */
export function computeTapeTransform(
  r: number,
  metrics: ShelfMetrics,
  viewportHalfWidth: number,
  lift: number,
  tiltXDeg: number,
  tiltYDeg: number
): TapeTransformState {
  const { H, ws, d, gap } = metrics;
  const x = computeTapeX(r, ws, d, gap);
  const visible = Math.abs(x) <= viewportHalfWidth + 1.5 * d;
  const o = smoothstep01(Math.max(0, 1 - Math.abs(r)));

  const y = -o * 0.025 * H - lift * 0.045 * H + 0;
  const z = o * 0.2 * H + 0;

  const rotYDeg = -90 * o + tiltYDeg * o + 0;
  const rotXDeg = tiltXDeg * o + 0;
  const rotZDeg = -4.5 * o + 0;

  const spineShade = o * 0.55;
  const coverShade = (1 - o) * 0.5;
  const zIndex = Math.round(100 - Math.abs(r) * 4);

  return {
    r,
    o,
    x,
    y,
    z,
    rotXDeg,
    rotYDeg,
    rotZDeg,
    spineShade,
    coverShade,
    zIndex,
    visible,
  };
}

/**
 * Returns the canonical film index (0..FILM_COUNT-1) for scroll position s.
 */
export function filmIndexFromScroll(s: number, count = FILM_COUNT): number {
  return ((Math.round(s) % count) + count) % count;
}

/**
 * Finds the nearest integer target to currentTarget whose film index equals targetFilmIndex.
 */
export function shortestLoopTarget(
  currentTarget: number,
  targetFilmIndex: number,
  count = FILM_COUNT
): number {
  const base = Math.round(currentTarget);
  const currentMod = ((base % count) + count) % count;
  let delta = targetFilmIndex - currentMod;
  if (delta > count / 2) delta -= count;
  if (delta < -count / 2) delta += count;
  return base + delta;
}

/**
 * Normalizes scroll s and target T by whole loops if s drifts beyond ±4 full loops.
 */
export function normalizeScrollLoop(
  s: number,
  T: number,
  count = FILM_COUNT,
  maxLoops = 4
): { s: number; T: number } {
  const limit = count * maxLoops;
  if (Math.abs(s) > limit) {
    const shift = Math.trunc(s / count) * count;
    return { s: s - shift, T: T - shift };
  }
  return { s, T };
}

/**
 * Exponential damping step: current + (target - current) * (1 - exp(-k * dt)).
 */
export function expDamp(
  current: number,
  target: number,
  k: number,
  dt: number,
  snapEpsilon = 1e-4
): number {
  if (Math.abs(target - current) <= snapEpsilon) {
    return target;
  }
  const factor = 1 - Math.exp(-k * dt);
  const next = current + (target - current) * factor;
  if (Math.abs(target - next) <= snapEpsilon) {
    return target;
  }
  return next;
}

/**
 * Play ring scale: smoothstep(max(0, 1 - |T - s| * 3)), forced to 0 when detail is open.
 */
export function computePlayRingScale(T: number, s: number, isOpen: boolean): number {
  if (isOpen) return 0;
  return smoothstep01(Math.max(0, 1 - Math.abs(T - s) * 3));
}

/**
 * Computes SVG <image> coordinates for the 474 x 900 detail poster crop.
 */
export function computePosterImageBox(filmId: string): PosterImageBox {
  const crop: CropBox = CROPS[`cover-${filmId}`];
  const sheet = SHEETS[crop.sheet];
  const viewW = 474;
  const viewH = 900;
  return {
    href: sheet.url,
    x: (-crop.x * viewW) / crop.w,
    y: (-crop.y * viewH) / crop.h,
    width: (sheet.width * viewW) / crop.w,
    height: (sheet.height * viewH) / crop.h,
  };
}

/**
 * Computes an ink blot circle radius for elapsed milliseconds since ink start (520ms after open).
 */
export function computeInkBlobRadius(
  elapsedSinceInkStartMs: number,
  delayMs: number,
  durationMs = 1250,
  maxRadius = 720
): number {
  const local = elapsedSinceInkStartMs - delayMs;
  if (local <= 0) return 0;
  const p = Math.min(1, local / durationMs);
  const eased = 1 - Math.pow(1 - p, 3);
  return eased * maxRadius;
}

/**
 * Converts a cover screen rect into a clip-path inset string for Web Animations API.
 */
export function computeSheetClipInset(
  rect: ScreenRect,
  viewportW: number,
  viewportH: number
): string {
  const top = Math.max(0, rect.top);
  const left = Math.max(0, rect.left);
  const right = Math.max(0, viewportW - rect.right);
  const bottom = Math.max(0, viewportH - rect.bottom);
  return `inset(${top.toFixed(1)}px ${right.toFixed(1)}px ${bottom.toFixed(1)}px ${left.toFixed(1)}px round 3px)`;
}
