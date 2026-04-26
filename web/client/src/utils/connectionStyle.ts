export interface ConnectionStyle {
  stroke: string;
  strokeDasharray?: string;
  animated: boolean;
  color: string;
}

/**
 * Returns the visual style for an edge based on time remaining and stale status.
 * @param remainingMs - milliseconds until expiry (negative = already expired)
 * @param isStale     - true when connection has expired but is within the 6-hour grace window
 * @param isExpired   - true when connection is officially marked as expired
 */
export function connectionStyle(remainingMs: number, isStale: boolean, isExpired: boolean): ConnectionStyle {
  // All connections should be dashed and animated as requested.
  const strokeDasharray = '6 3';
  const animated = true;

  if (isExpired) {
    return { stroke: '#374151', strokeDasharray: '2 2', animated: false, color: '#1f2937' };
  }

  if (isStale) {
    return { stroke: '#acadae', strokeDasharray, animated, color: '#6b7280' }; // grey dashed
  }

  if (remainingMs < 30 * 60 * 1000) {
    // < 30 minutes — red
    return { stroke: '#ef4444', strokeDasharray, animated, color: '#ef4444' };
  }

  if (remainingMs < 60 * 60 * 1000) {
    // 30–60 minutes — orange
    return { stroke: '#f59e0b', strokeDasharray, animated, color: '#f59e0b' };
  }

  // > 60 minutes — green
  return { stroke: '#0ee25e', strokeDasharray, animated, color: '#22c55e' };
}
