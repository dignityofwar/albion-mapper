import { expect, test, vi, beforeEach } from 'vitest';
import { setupTestApp } from './testApp.js';
import { recordDbIncident, resetDbIncidents } from '../src/db_incidents.js';

const context = setupTestApp();

beforeEach(() => {
  resetDbIncidents();
});

test('GET /api/health returns room count', async () => {
  context.mockDb.query.mockResolvedValueOnce({
    rows: [{ count: '5' }],
  });

  const response = await context.app!.inject({
    method: 'GET',
    url: '/api/health',
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.status).toBe('ok');
  expect(body.roomCount).toBe(5);
  expect(body.discardedTransactions.total).toBe(0);
  expect(context.mockDb.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM rooms');
});

test('discarded transactions are reported but never make the endpoint unhealthy', async () => {
  // A discarded transaction must be visible for investigation without giving
  // the container healthcheck (which keys off the HTTP status) any way to take
  // the service down over a blip.
  recordDbIncident({ code: '25P03', message: 'terminated due to idle-in-transaction timeout' });
  recordDbIncident({ code: '57014', message: 'canceling statement due to statement timeout' });
  context.mockDb.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

  const response = await context.app!.inject({ method: 'GET', url: '/api/health' });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.status).toBe('ok');
  expect(body.discardedTransactions.total).toBe(2);
  expect(body.discardedTransactions.byReason.idle_in_transaction_timeout).toBe(1);
  expect(body.discardedTransactions.byReason.query_canceled).toBe(1);
  expect(body.discardedTransactions.lastReason).toBe('query_canceled');
});

test('ordinary query errors are not counted as discarded transactions', async () => {
  recordDbIncident({ code: '23505', message: 'duplicate key value violates unique constraint' });
  recordDbIncident(new Error('syntax error'));

  context.mockDb.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
  const response = await context.app!.inject({ method: 'GET', url: '/api/health' });

  expect(response.json().discardedTransactions.total).toBe(0);
});
