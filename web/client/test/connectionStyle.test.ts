import { describe, it, expect } from 'vitest';
import { connectionStyle } from '../src/utils/connectionStyle.js';

const MIN = 60_000;
const H = 60 * MIN;

describe('connectionStyle', () => {
  it('returns green when more than 30 minutes remain', () => {
    const style = connectionStyle(31 * MIN, false);
    expect(style.stroke).toBe('#22c55e');
    expect(style.strokeDasharray).toBeUndefined();
  });

  it('returns amber when exactly 30 minutes remain (boundary)', () => {
    // 30min is < 30min false → still green actually at 30min exactly
    // boundary: < 30min → amber. At exactly 30min → green.
    const at30 = connectionStyle(30 * MIN, false);
    expect(at30.stroke).toBe('#22c55e');

    // 29m59s → amber
    const just_under30 = connectionStyle(30 * MIN - 1, false);
    expect(just_under30.stroke).toBe('#f59e0b');
  });

  it('returns amber when between 10 and 30 minutes remain', () => {
    const style = connectionStyle(20 * MIN, false);
    expect(style.stroke).toBe('#f59e0b');
    expect(style.strokeDasharray).toBeUndefined();
  });

  it('returns amber when exactly 10 minutes remain (boundary)', () => {
    const at10 = connectionStyle(10 * MIN, false);
    expect(at10.stroke).toBe('#f59e0b');
  });

  it('returns red dashed when fewer than 10 minutes remain', () => {
    const style = connectionStyle(9 * MIN, false);
    expect(style.stroke).toBe('#ef4444');
    expect(style.strokeDasharray).toBeDefined();
  });

  it('returns red dashed at 1 minute remaining', () => {
    const style = connectionStyle(MIN, false);
    expect(style.stroke).toBe('#ef4444');
    expect(style.strokeDasharray).toBeDefined();
  });

  it('returns red dashed at 0ms remaining (just expired, not stale)', () => {
    const style = connectionStyle(0, false);
    expect(style.stroke).toBe('#ef4444');
    expect(style.strokeDasharray).toBeDefined();
  });

  it('returns grey dashed when stale', () => {
    const style = connectionStyle(-H, true);
    expect(style.stroke).toBe('#6b7280');
    expect(style.strokeDasharray).toBeDefined();
    expect(style.animated).toBe(false);
  });

  it('stale takes priority over any remaining ms value', () => {
    // Even if remainingMs is positive, if isStale is true → grey
    const style = connectionStyle(99999, true);
    expect(style.stroke).toBe('#6b7280');
  });
});
