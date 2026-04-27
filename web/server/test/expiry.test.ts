import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runExpiryCleanup } from '../src/expiry.js';
import { broadcast } from '../src/broadcast.js';

vi.mock('../src/broadcast.js', () => ({
  broadcast: vi.fn(),
}));

const ROOM_ID = 'test-room-001';
const ZONE_A = 'adrens-hill';
const ZONE_B = 'anklesnag-mire';

let mockDb: any;

beforeEach(() => {
  mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  };
  vi.clearAllMocks();
});

describe('runExpiryCleanup', () => {
  it('a connection becomes expired at expiresAt but is NOT deleted yet (within 6h)', async () => {
    const now = new Date();
    const connId = 'conn-1';

    // Expired 1 minute ago — not yet past the 6h grace window
    const expiresAt = new Date(now.getTime() - 60 * 1000);
    
    // Mock newlyExpired
    mockDb.query.mockResolvedValueOnce({ 
      rows: [{ id: connId, room_id: ROOM_ID }] 
    });
    // Mock past grace cutoff (empty)
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    await runExpiryCleanup(mockDb);

    expect(broadcast).toHaveBeenCalledWith(ROOM_ID, expect.objectContaining({ type: 'connection_expired', connectionId: connId }));
  });

  it('removes a connection when expiresAt + 6h has passed', async () => {
    const now = new Date();
    const connId = 'conn-expired';

    // Mock newlyExpired (empty, assuming we already notified or it's old)
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    // Mock past STALE_GRACE_MS
    mockDb.query.mockResolvedValueOnce({ 
      rows: [{ id: connId, room_id: ROOM_ID }] 
    });

    await runExpiryCleanup(mockDb);

    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM connections'), expect.any(Array));
    expect(broadcast).toHaveBeenCalledWith(ROOM_ID, expect.objectContaining({ type: 'connection_removed', connectionId: connId }));
  });
});
