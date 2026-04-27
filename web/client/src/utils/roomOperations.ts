import { API_BASE_URL } from './api';

/**
 * API operations for a room. All functions accept the room ID and auth token
 * so they can be called from any component without direct store access.
 */


/**
 * Deletes a connection by ID from the given room.
 */
export async function deleteConnection(
  roomId: string,
  token: string,
  connectionId: string,
): Promise<void> {
  await fetch(`${API_BASE_URL}/api/rooms/${roomId}/connections/${connectionId}`, {
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
  secondsRemaining: number,
): Promise<void> {
  await fetch(`${API_BASE_URL}/api/rooms/${roomId}/connections/${connectionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ secondsRemaining: Number(secondsRemaining) }),
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
  secondsRemaining: number,
): Promise<void> {
  await fetch(`${API_BASE_URL}/api/rooms/${roomId}/connections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fromZoneId, toZoneId, secondsRemaining }),
  });
}
