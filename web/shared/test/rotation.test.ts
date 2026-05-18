import { describe, it, expect } from 'vitest';
import { rotationStepsToDegrees, rotateClockwise, rotateCounterClockwise } from '../src/rotation.js';

describe('rotationStepsToDegrees', () => {
  it('returns 0 degrees for step 0 (default orientation)', () => {
    expect(rotationStepsToDegrees(0)).toBe(0);
  });

  it('returns 90 degrees for step 1 (one clockwise rotation)', () => {
    expect(rotationStepsToDegrees(1)).toBe(90);
  });

  it('returns 180 degrees for step 2 (two clockwise rotations)', () => {
    expect(rotationStepsToDegrees(2)).toBe(180);
  });

  it('returns 270 degrees for step 3 (three clockwise rotations)', () => {
    expect(rotationStepsToDegrees(3)).toBe(270);
  });

  it('wraps step 4 back to 0 degrees', () => {
    expect(rotationStepsToDegrees(4)).toBe(0);
  });

  it('handles negative steps correctly (step -1 = 270 degrees)', () => {
    expect(rotationStepsToDegrees(-1)).toBe(270);
  });
});

describe('rotateClockwise', () => {
  it('rotates from step 0 to step 1 (90 degrees clockwise)', () => {
    expect(rotateClockwise(0)).toBe(1);
  });

  it('rotates from step 1 to step 2', () => {
    expect(rotateClockwise(1)).toBe(2);
  });

  it('rotates from step 3 back to step 0 (wraps around)', () => {
    expect(rotateClockwise(3)).toBe(0);
  });
});

describe('rotateCounterClockwise', () => {
  it('rotates from step 1 to step 0', () => {
    expect(rotateCounterClockwise(1)).toBe(0);
  });

  it('rotates from step 0 to step 3 (wraps around)', () => {
    expect(rotateCounterClockwise(0)).toBe(3);
  });

  it('rotates from step 2 to step 1', () => {
    expect(rotateCounterClockwise(2)).toBe(1);
  });
});

describe('rotation save scenario', () => {
  it('rotating a node 90 degrees clockwise from default results in step 1 saved', () => {
    const initialRotation = 0;
    const afterOneClockwise = rotateClockwise(initialRotation);
    expect(afterOneClockwise).toBe(1);
    expect(rotationStepsToDegrees(afterOneClockwise)).toBe(90);
  });

  it('rotating a node 180 degrees (two clockwise steps) results in step 2 saved', () => {
    const afterTwoClockwise = rotateClockwise(rotateClockwise(0));
    expect(afterTwoClockwise).toBe(2);
    expect(rotationStepsToDegrees(afterTwoClockwise)).toBe(180);
  });
});
