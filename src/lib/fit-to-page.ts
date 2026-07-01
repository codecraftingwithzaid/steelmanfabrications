/**
 * Shrink-to-fit density calculation for the single-page A4 document.
 *
 * Strategy: the page is a fixed A4 canvas. The line-items area is allowed to
 * grow, but must never push the footer off the page. We render at a density
 * scale (font-size / row-padding multiplier) and step it down until the
 * content fits within the available height, down to a legible minimum (~8pt).
 */

export const DENSITY_STEPS = [
  1, 0.97, 0.94, 0.91, 0.88, 0.85, 0.82, 0.79, 0.76, 0.73, 0.7, 0.67, 0.64,
  0.62,
] as const;

export const MIN_DENSITY = DENSITY_STEPS[DENSITY_STEPS.length - 1];

/**
 * Given the measurable overflow at the current scale, decide whether to step
 * down. Returns the next scale to try, or null when already fitting / at min.
 *
 * @param overflowing  whether content currently exceeds the page
 * @param currentScale the scale used for the current measurement
 */
export function nextDensity(
  overflowing: boolean,
  currentScale: number,
): number | null {
  if (!overflowing) return null;
  const idx = DENSITY_STEPS.findIndex((s) => s <= currentScale + 1e-6);
  const next = DENSITY_STEPS[idx + 1];
  return next ?? null; // null => already at minimum, accept as-is
}
