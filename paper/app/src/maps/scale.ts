/** Скільки міліметрів на папері займає 1 метр місцевості в масштабі 1:scale. */
export const mmPerMeter = (scale: number) => 1000 / scale;

export const r3 = (v: number) => Math.round(v * 1000) / 1000;

export type Frame = { minX: number; maxX: number; minY: number; maxY: number; margin: number; k: number };

export const frameSize = (f: Frame) => ({
  w: r3((f.maxX - f.minX) * f.k + 2 * f.margin),
  h: r3((f.maxY - f.minY) * f.k + 2 * f.margin),
});

/** Метри (x — схід, y — північ) → міліметри SVG (y донизу). */
export const project = (f: Frame, x: number, y: number) => ({
  x: r3((x - f.minX) * f.k + f.margin),
  y: r3((f.maxY - y) * f.k + f.margin),
});
