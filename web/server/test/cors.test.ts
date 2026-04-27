import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../src/app.js';

describe('CORS', () => {
  it('includes PATCH and DELETE in Access-Control-Allow-Methods', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      connect: vi.fn(),
    };
    const app = await buildApp({ db: mockDb as any, disableRateLimit: true });
    await app.ready();

    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/rooms/some-room/connections/some-conn',
      headers: {
        'Origin': 'https://roadmap.dignityofwar.com',
        'Access-Control-Request-Method': 'PATCH',
      },
    });

    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
    
    await app.close();
  });
});
