export interface ConnectionStyle {
  stroke: string;
  strokeDasharray?: string;
  animated: boolean;
}

/**
 * Returns the visual style for an edge based on time remaining and stale status.
 * @param remainingMs - milliseconds until expiry (negative = already expired)
 * @param isStale     - true when connection has expired but is within the 6-hour grace window
 */
export function connectionStyle(remainingMs: number, isStale: boolean): ConnectionStyle {
  if (isStale) {
    return { stroke: '#6b7280', strokeDasharray: '6 3', animated: false }; // grey dashed
  }

  if (remainingMs < 10 * 60 * 1000) {
    // < 10 minutes — red dashed
    return { stroke: '#ef4444', strokeDasharray: '6 3', animated: true };
  }

  if (remainingMs < 30 * 60 * 1000) {
    // 10–30 minutes — amber
    return { stroke: '#f59e0b', animated: true };
  }

  // > 30 minutes — green
  return { stroke: '#22c55e', animated: true };
}
