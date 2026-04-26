/**
 * Formats a Date object as "DD/Mon HH:MM:SS" for the status bar.
 */
export function formatTime(d: Date): string {
  const day   = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' }); // "Apr", "Jan", …
  const hh    = String(d.getHours()).padStart(2, '0');
  const mm    = String(d.getMinutes()).padStart(2, '0');
  const ss    = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month} ${hh}:${mm}:${ss}`;
}

/**
 * Formats milliseconds remaining.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

/**
 * Formats milliseconds remaining.
 * Returns "Expires in: 00:00" when ms is zero or negative.
 */
export function formatExpiresIn(ms: number): string {
  if (ms <= 0) return 'Expires in: 00:00';
  return `Expires in: ${formatCountdown(ms)}`;
}
