/**
 * Counters for transactions the database discarded out from under the app —
 * query cancellation, idle-in-transaction timeout, backend termination, deadlock.
 *
 * These are not ordinary rollbacks (several handlers ROLLBACK deliberately).
 * Each one means work was abandoned mid-flight, so a non-zero count is always
 * worth investigating: it is the visible symptom of a transaction that stalled
 * long enough for the server to give up on it.
 */

export type DiscardReason =
  | 'query_canceled'
  | 'idle_in_transaction_timeout'
  | 'connection_terminated'
  | 'deadlock'
  | 'serialization_failure';

// 57014 is query_canceled, which covers an explicit pg_cancel_backend as well as
// statement_timeout — named for the SQLSTATE rather than the presumed cause.
const REASON_BY_PG_CODE: Record<string, DiscardReason> = {
  '57014': 'query_canceled',
  '25P03': 'idle_in_transaction_timeout',
  '57P01': 'connection_terminated',
  '57P02': 'connection_terminated',
  '08006': 'connection_terminated',
  '40P01': 'deadlock',
  '40001': 'serialization_failure',
};

export interface DbIncidents {
  total: number;
  byReason: Record<DiscardReason, number>;
  lastAt: string | null;
  lastReason: DiscardReason | null;
  /**
   * Failures to check a connection out of the pool. Counted separately and
   * deliberately excluded from `total`: no statement ever reached the server, so
   * no transaction was discarded. It means saturation, not abandoned work.
   */
  poolAcquisitionTimeouts: number;
}

function emptyCounts(): Record<DiscardReason, number> {
  return {
    query_canceled: 0,
    idle_in_transaction_timeout: 0,
    connection_terminated: 0,
    deadlock: 0,
    serialization_failure: 0,
  };
}

let counts = emptyCounts();
let total = 0;
let lastAt: string | null = null;
let lastReason: DiscardReason | null = null;
let poolAcquisitionTimeouts = 0;

function isPoolAcquisitionTimeout(err: unknown): boolean {
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.includes('timeout exceeded when trying to connect');
}

/** Maps a pg error to a discard reason, or null if it is an ordinary query error. */
export function classifyDbError(err: unknown): DiscardReason | null {
  if (!err || typeof err !== 'object') return null;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && REASON_BY_PG_CODE[code]) return REASON_BY_PG_CODE[code];
  return null;
}

/** Records a discarded transaction or pool timeout, if the error is one. */
export function recordDbIncident(err: unknown, at: string = new Date().toISOString()): DiscardReason | null {
  if (isPoolAcquisitionTimeout(err)) {
    poolAcquisitionTimeouts += 1;
    return null;
  }
  const reason = classifyDbError(err);
  if (!reason) return null;
  counts[reason] += 1;
  total += 1;
  lastAt = at;
  lastReason = reason;
  return reason;
}

export function getDbIncidents(): DbIncidents {
  return { total, byReason: { ...counts }, lastAt, lastReason, poolAcquisitionTimeouts };
}

export function resetDbIncidents(): void {
  counts = emptyCounts();
  total = 0;
  lastAt = null;
  lastReason = null;
  poolAcquisitionTimeouts = 0;
}

// ─── Pool instrumentation ────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;

interface InstrumentableClient {
  query: AnyFn;
  on?: AnyFn;
  __incidentsWatched?: boolean;
}

export interface InstrumentablePool {
  query: AnyFn;
  connect: AnyFn;
  on?: AnyFn;
}

function watch<T>(result: Promise<T>): Promise<T> {
  return result.catch((err: unknown) => {
    recordDbIncident(err);
    throw err;
  });
}

function instrumentClient<T>(client: T): T {
  const target = client as InstrumentableClient | null;
  if (!target || target.__incidentsWatched) return client;

  const clientQuery = target.query.bind(target);
  target.query = (...args: unknown[]) => {
    const result = clientQuery(...args);
    // Callback-form queries return a Query object rather than a promise; their
    // errors reach the callback, so leave them untouched.
    return result instanceof Promise ? watch(result) : result;
  };

  // A checked-out client has no 'error' listener — pg-pool removes its idle one
  // on acquire and only restores it on release. Without this, a backend killed
  // while the client sits idle mid-transaction (exactly what
  // idle_in_transaction_session_timeout does) emits an unhandled 'error' event
  // and takes the process down.
  target.on?.('error', (err: unknown) => {
    recordDbIncident(err);
  });

  target.__incidentsWatched = true;
  return client;
}

/**
 * Counts every discarded transaction at the pool and at each checked-out client,
 * so no call site can swallow one.
 *
 * `connect` must keep both overloads: pg-pool implements `pool.query()` in terms
 * of `pool.connect(callback)`, and a promise-only replacement returns undefined
 * to it — which surfaces as an unhandled rejection on every pooled query.
 */
export function instrumentPool(pool: InstrumentablePool): void {
  const poolQuery = pool.query.bind(pool);
  pool.query = (...args: unknown[]) => {
    const result = poolQuery(...args);
    return result instanceof Promise ? watch(result) : result;
  };

  const poolConnect = pool.connect.bind(pool);
  pool.connect = (callback?: unknown) => {
    if (typeof callback === 'function') {
      return poolConnect((err: unknown, client: unknown, done: unknown) => {
        if (err) recordDbIncident(err);
        else instrumentClient(client);
        (callback as AnyFn)(err, client, done);
      });
    }
    return watch(poolConnect()).then(instrumentClient);
  };

  // Errors on connections sitting idle in the pool are emitted, not thrown.
  pool.on?.('error', (err: unknown) => {
    recordDbIncident(err);
  });
}
