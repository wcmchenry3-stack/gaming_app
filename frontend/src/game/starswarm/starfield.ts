export interface Star {
  x: number;
  y: number;
  /** Logical radius in canvas pixels. */
  r: number;
  /** 0–1 alpha. */
  opacity: number;
  /** Downward scroll speed in px/ms. */
  speed: number;
}

export interface StarfieldState {
  stars: readonly Star[];
  width: number;
  height: number;
}

// Three depth layers: far (slow/dim/tiny), mid, near (fast/bright/large).
const LAYERS = [
  { count: 50, speed: 0.02, r: 0.6, opacity: 0.35 },
  { count: 30, speed: 0.05, r: 1.0, opacity: 0.65 },
  { count: 15, speed: 0.10, r: 1.4, opacity: 1.0 },
] as const;

/** Deterministic LCG so tests can use a fixed seed. */
function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function initStarfield(
  width: number,
  height: number,
  seed = 42,
): StarfieldState {
  const rand = makePrng(seed);
  const stars: Star[] = [];
  for (const layer of LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      stars.push({
        x: rand() * width,
        y: rand() * height,
        r: layer.r,
        opacity: layer.opacity,
        speed: layer.speed,
      });
    }
  }
  return { stars, width, height };
}

export function tickStarfield(
  state: StarfieldState,
  dtMs: number,
): StarfieldState {
  const { width, height } = state;
  const stars = state.stars.map((s) => {
    const y = s.y + s.speed * dtMs;
    return y > height ? { ...s, y: y - height } : { ...s, y };
  });
  return { stars, width, height };
}
