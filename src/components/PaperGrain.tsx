const GRAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.42  0 0 0 0 0.38  0 0 0 0.22 0"/></filter><rect width="220" height="220" filter="url(#g)"/></svg>`;

const GRAIN_DATA_URL = `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`;

export function PaperGrain() {
  return (
    <div
      className="paper-grain"
      aria-hidden="true"
      style={{ backgroundImage: GRAIN_DATA_URL }}
    />
  );
}
