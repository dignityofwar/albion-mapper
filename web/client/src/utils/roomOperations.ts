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
  const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/connections/${connectionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json() as { error?: string };
    throw new Error(body.error ?? 'Failed to delete connection');
  }
}

/**
 * Updates a connection's expiration time.
 */
export async function updateConnection(
  roomId: string,
  token: string,
  connectionId: string,
  update: { secondsRemaining?: number; fromHandleId?: string; toHandleId?: string },
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/connections/${connectionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(update),
  });

  if (!res.ok) {
    const body = await res.json() as { error?: string };
    throw new Error(body.error ?? 'Failed to update connection');
  }
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
  fromHandleId?: string,
  toHandleId?: string,
  reportedBy?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/connections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fromZoneId,
      toZoneId,
      secondsRemaining,
      fromHandleId,
      toHandleId,
      reportedBy,
    }),
  });

  if (!res.ok) {
    const body = await res.json() as { error?: string };
    throw new Error(body.error ?? 'Failed to add connection');
  }
}
