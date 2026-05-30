/**
 * Rotation is stored as the number of clockwise 90° steps from the default orientation.
 * 0 = default, 1 = 90° clockwise, 2 = 180°, 3 = 270° clockwise.
 */

export function rotationStepsToDegrees(steps: number): number {
  return ((steps % 4) + 4) % 4 * 90;
}

export function rotateClockwise(currentSteps: number): number {
  return ((currentSteps + 1) % 4 + 4) % 4;
}

export function rotateCounterClockwise(currentSteps: number): number {
  return ((currentSteps - 1) % 4 + 4) % 4;
}

/**
 * Converts a handle (x%, y%) position to a perimeter parameter t in [0, 4).
 * The diamond perimeter goes: top(0.5,0) -> right(1,0.5) -> bottom(0.5,1) -> left(0,0.5).
 * t=0 is top, t=1 is right, t=2 is bottom, t=3 is left.
 */
function handleToT(xPercent: number, yPercent: number): number {
  const d0 = Math.abs((xPercent - 50) - yPercent);
  const d1 = Math.abs((xPercent - 100) + (yPercent - 50));
  const d2 = Math.abs((xPercent - 50) - (yPercent - 100));
  const d3 = Math.abs(xPercent + (yPercent - 50));

  const minDist = Math.min(d0, d1, d2, d3);

  if (minDist === d0) return Math.max(0, Math.min(1, (xPercent - 50) / 50));
  if (minDist === d1) return 1 + Math.max(0, Math.min(1, (100 - xPercent) / 50));
  if (minDist === d2) return 2 + Math.max(0, Math.min(1, (50 - xPercent) / 50));
  return 3 + Math.max(0, Math.min(1, xPercent / 50));
}

/**
 * Given a set of actual handle positions and the default (unrotated) handle positions
 * for the same shape, infers the most likely rotation step (0–3) that was applied.
 *
 * Returns null if the handles are empty, counts don't match, or no consistent
 * rotation can be determined (e.g. custom/non-shape handles).
 */
export function inferRotationFromHandles(
  actualHandles: { id: string; left: string; top: string }[],
  defaultHandles: { id: string; left: string; top: string }[],
): number | null {
  if (actualHandles.length === 0 || defaultHandles.length === 0) return null;
  if (actualHandles.length !== defaultHandles.length) return null;

  const rotationVotes: number[] = [];

  for (let i = 0; i < defaultHandles.length; i++) {
    const def = defaultHandles[i];
    const act = actualHandles.find(h => h.id === def.id);
    if (!act) return null;

    const tDefault = handleToT(parseFloat(def.left), parseFloat(def.top));
    const tActual = handleToT(parseFloat(act.left), parseFloat(act.top));

    const diff = tActual - tDefault;
    const steps = Math.round(((diff % 4) + 4) % 4);
    rotationVotes.push(steps);
  }

  // All handles must agree on the same rotation step
  const allAgree = rotationVotes.every(v => v === rotationVotes[0]);
  if (!allAgree) return null;

  return rotationVotes[0];
}
