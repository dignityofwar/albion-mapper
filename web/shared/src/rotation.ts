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
