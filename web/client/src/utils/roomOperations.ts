/**
 * API operations for a room. All functions accept the room ID and auth token
 * so they can be called from any component without direct store access.
 */

/**
 * Sets the home zone for the given room.
 * No-ops if zoneId is already the current home zone (caller's responsibility to check).
 */
export async function setHomeZone(
  roomId: string,
  token: string,
  zoneId: string,
): Promise<void> {
  await fetch(`/api/rooms/${roomId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ homeZoneId: zoneId }),
  });
}

/**
 * Deletes a connection by ID from the given room.
 */
export async function deleteConnection(
  roomId: string,
  token: string,
  connectionId: string,
): Promise<void> {
  await fetch(`/api/rooms/${roomId}/connections/${connectionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
