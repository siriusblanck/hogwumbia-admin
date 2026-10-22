// The night sky over Low Library, drawn from a seed so the server and the browser agree on
// every star. Positions are percentages of the frame; sizes are CSS pixels; times are seconds.

export type Star = { x: number; y: number; r: number; opacity: number; warm: boolean };
export type Glint = { x: number; y: number; size: number; delay: number; duration: number; kind: "dot" | "spark" };

const round = (value: number) => Math.round(value * 100) / 100;
const between = (unit: number, low: number, high: number) => round(low + unit * (high - low));

/** mulberry32: a tiny, well-mixed 32-bit generator. Plenty for scattering stars. */
function randomFrom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Still stars: thicker toward the top of the sky, a few of them warm. */
export function starField(seed: number, count: number): Star[] {
  const random = randomFrom(seed);
  return Array.from({ length: count }, () => {
    const x = Math.min(between(random(), 0, 100), 99.99);
    const y = Math.min(round(100 * random() ** 1.5), 99.99);
    const size = random() ** 2; // mostly small, the odd bright one
    return {
      x,
      y,
      r: between(size, 0.5, 1.6),
      opacity: between(0.35 * random() + 0.65 * size, 0.25, 0.95),
      warm: random() < 1 / 12,
    };
  });
}

/** Stars that glitter: twinkling dots, and every third a four-point sparkle, above the rooftops. */
export function glints(seed: number, count: number): Glint[] {
  const random = randomFrom(seed);
  return Array.from({ length: count }, (_, index) => {
    const kind = index % 3 === 2 ? "spark" : "dot";
    const duration = between(random(), 2.4, 6);
    return {
      kind,
      x: Math.min(between(random(), 0, 100), 99.99),
      y: Math.min(round(70 * random() ** 1.3), 69.99),
      size: kind === "spark" ? between(random(), 9, 18) : between(random(), 2, 3.5),
      duration,
      delay: Math.min(round(random() * duration), round(duration - 0.01)),
    };
  });
}
