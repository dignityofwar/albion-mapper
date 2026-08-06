/**
 * Tests for the pool instrumentation that counts discarded transactions.
 *
 * The rest of the server suite injects a mocked pool into buildApp(), so it can
 * never exercise this wiring. These tests drive it against a fake that mimics
 * the parts of pg-pool's contract that matter — in particular that pg-pool
 * implements `pool.query()` in terms of `pool.connect(callback)`, which is the
 * path a promise-only `connect` override silently breaks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  instrumentPool,
  recordDbIncident,
  classifyDbError,
  getDbIncidents,
  resetDbIncidents,
} from '../src/db_incidents.js';

class FakeClient extends EventEmitter {
  released = false;
  constructor(private readonly onQuery: (sql: string) => Promise<unknown>) {
    super();
  }
  query(sql: string, _values?: unknown, cb?: (err: unknown, res?: unknown) => void) {
    const result = this.onQuery(sql);
    if (typeof cb === 'function') {
      // Callback form returns a Query object, not a promise — as pg does.
      result.then((res) => cb(undefined, res), (err) => cb(err));
      return { callbackForm: true };
    }
    return result;
  }
  release() {
    this.released = true;
  }
}

/** Mimics pg-pool: `query()` is implemented via `connect(callback)`. */
class FakePool extends EventEmitter {
  constructor(private readonly onQuery: (sql: string) => Promise<unknown> = async () => ({ rows: [] })) {
    super();
  }
  connect(cb?: (err: unknown, client?: FakeClient, done?: () => void) => void) {
    const client = new FakeClient(this.onQuery);
    if (typeof cb === 'function') {
      // pg-pool's callback form returns undefined, not a promise.
      setImmediate(() => cb(undefined, client, () => {}));
      return undefined;
    }
    return Promise.resolve(client);
  }
  query(sql: string) {
    return new Promise((resolve, reject) => {
      this.connect((err, client) => {
        if (err) return reject(err);
        client!.query(sql, undefined, (qErr, res) => (qErr ? reject(qErr) : resolve(res)));
      });
    });
  }
}

const timeoutError = (code: string) => Object.assign(new Error(`pg error ${code}`), { code });

beforeEach(() => {
  resetDbIncidents();
});

describe('classification', () => {
  it('classifies discarded transactions by SQLSTATE', () => {
    expect(classifyDbError(timeoutError('25P03'))).toBe('idle_in_transaction_timeout');
    expect(classifyDbError(timeoutError('57014'))).toBe('query_canceled');
    expect(classifyDbError(timeoutError('57P01'))).toBe('connection_terminated');
    expect(classifyDbError(timeoutError('40P01'))).toBe('deadlock');
  });

  it('does not classify ordinary query errors', () => {
    expect(classifyDbError(timeoutError('23505'))).toBeNull(); // unique violation
    expect(classifyDbError(new Error('syntax error'))).toBeNull();
    expect(classifyDbError(null)).toBeNull();
    expect(classifyDbError(undefined)).toBeNull();
  });

  it('counts pool acquisition timeouts separately from discarded transactions', () => {
    // No statement reached the server, so no transaction was discarded — this is
    // saturation, and folding it into the discard total would mislead an alert.
    recordDbIncident(new Error('timeout exceeded when trying to connect'));

    const incidents = getDbIncidents();
    expect(incidents.poolAcquisitionTimeouts).toBe(1);
    expect(incidents.total).toBe(0);
  });
});

describe('instrumentPool', () => {
  it('keeps pool.query working when pg-pool routes it through connect(callback)', async () => {
    // Regression: overriding connect with a promise-only async function returns
    // undefined to pg-pool's internal callback path, producing an unhandled
    // rejection on every pooled query — fatal on modern Node defaults.
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    const pool = new FakePool();
    instrumentPool(pool as never);

    await expect(pool.query('SELECT 1')).resolves.toEqual({ rows: [] });
    await new Promise((r) => setImmediate(r));

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('records a discarded transaction from a pooled query', async () => {
    const pool = new FakePool(() => Promise.reject(timeoutError('57014')));
    instrumentPool(pool as never);

    await expect(pool.query('SELECT 1')).rejects.toThrow();

    const incidents = getDbIncidents();
    expect(incidents.total).toBe(1);
    expect(incidents.byReason.query_canceled).toBe(1);
  });

  it('records a discarded transaction from a checked-out client', async () => {
    const pool = new FakePool(() => Promise.reject(timeoutError('25P03')));
    instrumentPool(pool as never);

    const client = await (pool.connect() as unknown as Promise<FakeClient>);
    await expect(client.query('COMMIT')).rejects.toThrow();

    expect(getDbIncidents().byReason.idle_in_transaction_timeout).toBe(1);
  });

  it('handles an error event on a checked-out client instead of crashing', async () => {
    // pg-pool removes its idle error listener on acquire, so an unlistened
    // 'error' would be thrown by EventEmitter and take the process down. That is
    // exactly what idle_in_transaction_session_timeout provokes.
    const pool = new FakePool();
    instrumentPool(pool as never);

    const client = await (pool.connect() as unknown as Promise<FakeClient>);
    expect(() => client.emit('error', timeoutError('57P01'))).not.toThrow();

    expect(getDbIncidents().byReason.connection_terminated).toBe(1);
  });

  it('instruments a client only once across repeated checkouts', async () => {
    const pool = new FakePool(() => Promise.reject(timeoutError('40P01')));
    instrumentPool(pool as never);

    const client = await (pool.connect() as unknown as Promise<FakeClient>);
    const reWrapped = await Promise.resolve(client);
    await expect(reWrapped.query('SELECT 1')).rejects.toThrow();

    // One failing query counts once, not once per instrumentation layer.
    expect(getDbIncidents().total).toBe(1);
  });
});
