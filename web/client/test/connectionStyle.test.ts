import { describe, it, expect } from 'vitest';
import { connectionStyle } from '../src/utils/connectionStyle.js';

const MIN = 60_000;
const H = 60 * MIN;

describe('connectionStyle', () => {
  it('returns green solid when more than 60 minutes remain', () => {
    const style = connectionStyle(61 * MIN, false);
    expect(style.stroke).toBe('#0ee25e');
    expect(style.color).toBe('#038c36');
    expect(style.strokeDasharray).toBeUndefined();
    expect(style.animated).toBe(false);
  });

  it('returns orange dashed and animated when between 30 and 60 minutes remain', () => {
    const style = connectionStyle(45 * MIN, false);
    expect(style.stroke).toBe('#f59e0b');
    expect(style.color).toBe('#ac6900');
    expect(style.strokeDasharray).toBe('6 3');
    expect(style.animated).toBe(true);
  });

  it('returns red dotted and animated when fewer than 30 minutes remain', () => {
    const style = connectionStyle(29 * MIN, false);
    expect(style.stroke).toBe('#ef4444');
    expect(style.color).toBe('#a30000');
    expect(style.strokeDasharray).toBe('2 4');
    expect(style.animated).toBe(true);
  });

  it('returns grey dotted and non-animated when expired', () => {
    const style = connectionStyle(-1, false);
    expect(style.stroke).toBe('#acadae');
    expect(style.color).toBe('#6b7280');
    expect(style.strokeDasharray).toBe('2 4');
    expect(style.animated).toBe(false);
  });

  it('isExpired flag takes priority and returns grey dotted', () => {
    const style = connectionStyle(H, true);
    expect(style.stroke).toBe('#acadae');
    expect(style.color).toBe('#6b7280');
    expect(style.strokeDasharray).toBe('2 4');
    expect(style.animated).toBe(false);
  });
});
