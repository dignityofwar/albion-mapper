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

/**
 * Updates a connection's expiration time.
 */
export async function updateConnection(
  roomId: string,
  token: string,
  connectionId: string,
  minutesRemaining: number,
): Promise<void> {
  await fetch(`/api/rooms/${roomId}/connections/${connectionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ minutesRemaining: Number(minutesRemaining) }),
  });
}

/**
 * Adds a connection to the given room.
 */
export async function addConnection(
  roomId: string,
  token: string,
  fromZoneId: string,
  toZoneId: string,
  minutesRemaining: number,
): Promise<void> {
  await fetch(`/api/rooms/${roomId}/connections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fromZoneId, toZoneId, minutesRemaining }),
  });
}
