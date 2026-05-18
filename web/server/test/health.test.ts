import { expect, test, vi } from 'vitest';
import { setupTestApp } from './testApp.js';

const context = setupTestApp();

test('GET /api/health returns room count', async () => {
  context.mockDb.query.mockResolvedValueOnce({
    rows: [{ count: '5' }],
  });

  const response = await context.app!.inject({
    method: 'GET',
    url: '/api/health',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: 'ok', roomCount: 5 });
  expect(context.mockDb.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM rooms');
});
