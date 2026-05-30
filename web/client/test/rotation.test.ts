import { describe, it, expect } from 'vitest';
import { inferRotationFromHandles } from 'shared';
import { getShapeHandlePositions } from 'shared';

// Helper: rotate handles by N steps (90° each) around the diamond centre.
// Each step maps (left, top) -> (100 - top, left)  (clockwise 90°).
function rotateHandles(handles: { id: string; left: string; top: string }[], steps: number) {
  let result = handles.map(h => ({ ...h }));
  for (let s = 0; s < steps; s++) {
    result = result.map(h => ({
      id: h.id,
      left: (100 - parseFloat(h.top)).toFixed(2) + '%',
      top: parseFloat(h.left).toFixed(2) + '%',
    }));
  }
  return result;
}

describe('inferRotationFromHandles', () => {
  for (const shape of ['t', 's', 'h', 'c', 'f', 'o', 'p', 'x'] as const) {
    describe(`shape "${shape}"`, () => {
      const defaults = getShapeHandlePositions(shape);

      for (const steps of [0, 1, 2, 3] as const) {
        it(`returns ${steps} when handles are rotated ${steps * 90}°`, () => {
          const rotated = rotateHandles(defaults, steps);
          const result = inferRotationFromHandles(rotated, defaults);
          expect(result).toBe(steps);
        });
      }
    });
  }

  it('returns null for empty actual handles', () => {
    const defaults = getShapeHandlePositions('t');
    expect(inferRotationFromHandles([], defaults)).toBeNull();
  });

  it('returns null for empty default handles', () => {
    const defaults = getShapeHandlePositions('t');
    expect(inferRotationFromHandles(defaults, [])).toBeNull();
  });

  it('returns null when handle counts differ', () => {
    const defaults = getShapeHandlePositions('t');
    expect(inferRotationFromHandles(defaults.slice(0, 3), defaults)).toBeNull();
  });

  it('returns null when handles are inconsistent (mixed rotations)', () => {
    const defaults = getShapeHandlePositions('t');
    const rot1 = rotateHandles(defaults, 1);
    const rot2 = rotateHandles(defaults, 2);
    // Mix handles from two different rotations — no consistent step
    const mixed = defaults.map((h, i) => (i % 2 === 0 ? rot1[i] : rot2[i]));
    expect(inferRotationFromHandles(mixed, defaults)).toBeNull();
  });

  it('returns null when an actual handle id is not found in defaults', () => {
    const defaults = getShapeHandlePositions('t');
    const wrongId = defaults.map((h, i) => i === 0 ? { ...h, id: 'unknown-id' } : h);
    expect(inferRotationFromHandles(wrongId, defaults)).toBeNull();
  });
});
