import { describe, it, expect } from 'vitest';
import { formatExpiresIn } from '../src/utils/formatters';

describe('formatExpiresIn', () => {
  it('should format sub-hour values as "m s"', () => {
    expect(formatExpiresIn(50 * 60 * 1000)).toBe('Expires in: 50m 0s');
    expect(formatExpiresIn(5 * 60 * 1000 + 30 * 1000)).toBe('Expires in: 5m 30s');
  });

  it('should format hour-based values as "h m"', () => {
    expect(formatExpiresIn(1 * 60 * 60 * 1000 + 59 * 60 * 1000)).toBe('Expires in: 1h 59m');
    expect(formatExpiresIn(5 * 60 * 60 * 1000 + 59 * 60 * 1000)).toBe('Expires in: 5h 59m');
  });

  it('should return "Expires in: 00:00" for non-positive values', () => {
    expect(formatExpiresIn(0)).toBe('Expires in: 00:00');
    expect(formatExpiresIn(-1000)).toBe('Expires in: 00:00');
  });
});
