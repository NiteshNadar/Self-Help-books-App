import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInkBlobRadius,
  computePlayRingScale,
  computePosterImageBox,
  computeSheetClipInset,
  computeTapeDimensions,
  computeTapeTransform,
  computeTapeX,
  expDamp,
  filmIndexFromScroll,
  normalizeScrollLoop,
  shortestLoopTarget,
  smoothStepB,
  smoothstep01,
  wrapRelativeIndex,
} from './shelfMath';
import { FILMS, INITIAL_FILM_INDEX, INITIAL_SCROLL } from './films';

test('smoothstep01 clamps and evaluates cubic Hermite curve', () => {
  assert.equal(smoothstep01(-1), 0);
  assert.equal(smoothstep01(0), 0);
  assert.equal(smoothstep01(0.5), 0.5);
  assert.equal(smoothstep01(1), 1);
  assert.equal(smoothstep01(2), 1);
});

test('computeTapeDimensions matches exact VHS slipcase aspect ratios', () => {
  const m = computeTapeDimensions(420);
  assert.equal(m.H, 420);
  assert.equal(m.ws, (420 * 142) / 840);
  assert.equal(m.d, (420 * 474) / 900);
  assert.equal(m.gap, 420 * 0.03);
});

test('wrapRelativeIndex wraps 36 tapes into [-18, +18)', () => {
  assert.equal(wrapRelativeIndex(17, 17), 0);
  assert.equal(wrapRelativeIndex(19, 17), 2);
  assert.equal(wrapRelativeIndex(0, 35), 1);
  assert.equal(wrapRelativeIndex(35, 0), -1);
  assert.equal(wrapRelativeIndex(35, 17), -18);
});

test('smoothStepB is continuous and odd-symmetric', () => {
  assert.equal(smoothStepB(0), 0);
  assert.equal(smoothStepB(1), 0.5);
  assert.equal(smoothStepB(-1), -0.5);
  assert.equal(smoothStepB(5), 0.5);
  assert.equal(smoothStepB(-5), -0.5);
  assert.ok(Math.abs(smoothStepB(0.5) + smoothStepB(-0.5)) < 1e-12);
});

test('computeTapeX pushes neighbors apart around the active cover', () => {
  const m = computeTapeDimensions(1);
  const x0 = computeTapeX(0, m.ws, m.d, m.gap);
  const x1 = computeTapeX(1, m.ws, m.d, m.gap);
  const x2 = computeTapeX(2, m.ws, m.d, m.gap);
  assert.equal(x0, 0);
  assert.ok(x1 > m.ws + m.gap, 'adjacent spine clears half of the open cover width');
  assert.ok(Math.abs((x2 - x1) - (m.ws + m.gap)) < 1e-9, 'subsequent spines step by ws + gap');
});

test('computeTapeTransform turns active tape -90deg Y, -4.5deg Z, lifted and pushed forward', () => {
  const m = computeTapeDimensions(400);
  const active = computeTapeTransform(0, m, 720, 0, 0, 0);
  assert.equal(active.o, 1);
  assert.equal(active.rotYDeg, -90);
  assert.equal(active.rotZDeg, -4.5);
  assert.equal(active.z, 0.2 * 400);
  assert.equal(active.y, -0.025 * 400);
  assert.equal(active.spineShade, 0.55);
  assert.equal(active.coverShade, 0);
  assert.equal(active.zIndex, 100);

  const spine = computeTapeTransform(2, m, 720, 1, 3, 5);
  assert.equal(spine.o, 0);
  assert.equal(spine.rotYDeg, 0);
  assert.equal(spine.rotZDeg, 0);
  assert.equal(spine.y, -0.045 * 400);
  assert.equal(spine.spineShade, 0);
  assert.equal(spine.coverShade, 0.5);
});

test('filmIndexFromScroll and shortestLoopTarget wrap cleanly across loop boundaries', () => {
  assert.equal(filmIndexFromScroll(INITIAL_SCROLL), INITIAL_FILM_INDEX);
  assert.equal(FILMS[filmIndexFromScroll(INITIAL_SCROLL)].id, 'noon');
  assert.equal(filmIndexFromScroll(-1), 11);

  // From index 5 (s=17) to index 9 (1980s, The Long Tide) should go +4 -> 21
  assert.equal(shortestLoopTarget(17, 9), 21);
  // From index 0 (s=12) to index 11 (Red Door) should go -1 -> 11
  assert.equal(shortestLoopTarget(12, 11), 11);
  // From index 11 (s=23) to index 0 (The Silent Valley) should go +1 -> 24
  assert.equal(shortestLoopTarget(23, 0), 24);
});

test('normalizeScrollLoop shifts both s and T by whole loops beyond 4 loops', () => {
  const res = normalizeScrollLoop(65, 66);
  assert.equal(res.s, 5);
  assert.equal(res.T, 6);
  assert.equal(filmIndexFromScroll(res.s), filmIndexFromScroll(65));
});

test('expDamp approaches target and snaps within epsilon', () => {
  const mid = expDamp(0, 10, 5.2, 0.016);
  assert.ok(mid > 0 && mid < 10);
  assert.equal(expDamp(9.99995, 10, 5.2, 0.016), 10);
});

test('computePlayRingScale pops in when settled and hides when moving or open', () => {
  assert.equal(computePlayRingScale(17, 17, false), 1);
  assert.equal(computePlayRingScale(17, 17, true), 0);
  assert.equal(computePlayRingScale(18, 17, false), 0);
  const partial = computePlayRingScale(17.15, 17, false);
  assert.ok(partial > 0 && partial < 1);
});

test('computePosterImageBox maps cover crop exactly to 474x900 viewBox', () => {
  const box = computePosterImageBox('noon');
  assert.ok(box.href.includes('images.higgs.ai'));
  assert.ok(Math.abs(box.x - (-74 * 474) / 347) < 1e-6);
  assert.ok(Math.abs(box.y - (-72 * 900) / 659) < 1e-6);
  assert.ok(Math.abs(box.width - (1744 * 474) / 347) < 1e-6);
  assert.ok(Math.abs(box.height - (2336 * 900) / 659) < 1e-6);
});

test('computeInkBlobRadius follows cubic ease-out from 0 to 720', () => {
  assert.equal(computeInkBlobRadius(100, 120), 0);
  assert.equal(computeInkBlobRadius(120, 120), 0);
  assert.equal(computeInkBlobRadius(120 + 1250, 120), 720);
  const half = computeInkBlobRadius(120 + 625, 120);
  assert.equal(half, 720 * (1 - 0.125));
});

test('computeSheetClipInset computes exact pixel inset from cover rect', () => {
  const inset = computeSheetClipInset(
    { left: 600, top: 200, right: 840, bottom: 650, width: 240, height: 450 },
    1440,
    900
  );
  assert.equal(inset, 'inset(200.0px 600.0px 250.0px 600.0px round 3px)');
});
