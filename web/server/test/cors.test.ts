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

  it('allows the test environment origins', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      connect: vi.fn(),
    };
    const app = await buildApp({ db: mockDb as any, disableRateLimit: true });
    await app.ready();

    const testOrigins = [
      'https://roadmap-test.dignityofwar.com',
      'https://roadmap-api-test.dignityofwar.com',
    ];

    for (const origin of testOrigins) {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/rooms',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST',
        },
      });
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }

    await app.close();
  });
});
