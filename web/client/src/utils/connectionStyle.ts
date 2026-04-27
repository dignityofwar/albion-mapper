export interface ConnectionStyle {
  stroke: string;
  strokeDasharray?: string;
  animated: boolean;
  color: string;
}

/**
 * Returns the visual style for an edge based on time remaining and expiry status.
 * @param remainingMs - milliseconds until expiry (negative = already expired)
 * @param isExpired   - true when connection is officially marked as expired
 */
export function connectionStyle(remainingMs: number, isExpired: boolean): ConnectionStyle {
  if (isExpired || remainingMs <= 0) {
    // Expired / grey = dotted but not animated
    return { stroke: '#acadae', strokeDasharray: '2 4', animated: false, color: '#6b7280' };
  }

  if (remainingMs < 30 * 60 * 1000) {
    // < 30m / red = dotted and animated
    return { stroke: '#ef4444', strokeDasharray: '2 4', animated: true, color: '#ef4444' };
  }

  if (remainingMs < 60 * 60 * 1000) {
    // <1hr / orange = dashed and animated
    return { stroke: '#f59e0b', strokeDasharray: '6 3', animated: true, color: '#f59e0b' };
  }

  // Green (> 60m) = solid
  return { stroke: '#0ee25e', animated: false, color: '#22c55e' };
}
