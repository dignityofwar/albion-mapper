/**
 * Counters for transactions the database discarded out from under the app —
 * statement timeout, idle-in-transaction timeout, backend termination, deadlock.
 *
 * These are not ordinary rollbacks (several handlers ROLLBACK deliberately).
 * Each one means work was abandoned mid-flight, so a non-zero count is always
 * worth investigating: it is the visible symptom of a transaction that stalled
 * long enough for the server to give up on it.
 */

export type DiscardReason =
  | 'statement_timeout'
  | 'idle_in_transaction_timeout'
  | 'connection_terminated'
  | 'deadlock'
  | 'serialization_failure'
  | 'pool_timeout';

const REASON_BY_PG_CODE: Record<string, DiscardReason> = {
  '57014': 'statement_timeout',
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
}

function emptyCounts(): Record<DiscardReason, number> {
  return {
    statement_timeout: 0,
    idle_in_transaction_timeout: 0,
    connection_terminated: 0,
    deadlock: 0,
    serialization_failure: 0,
    pool_timeout: 0,
  };
}

let counts = emptyCounts();
let total = 0;
let lastAt: string | null = null;
let lastReason: DiscardReason | null = null;

/** Maps a pg error to a discard reason, or null if it is an ordinary query error. */
export function classifyDbError(err: unknown): DiscardReason | null {
  if (!err || typeof err !== 'object') return null;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && REASON_BY_PG_CODE[code]) return REASON_BY_PG_CODE[code];
  // Pool exhaustion has no pg code — it never reaches the server.
  const message = (err as { message?: unknown }).message;
  if (typeof message === 'string' && message.includes('timeout exceeded when trying to connect')) {
    return 'pool_timeout';
  }
  return null;
}

/** Records a discarded transaction if the error represents one. Returns the reason, if any. */
export function recordDbIncident(err: unknown, at: string = new Date().toISOString()): DiscardReason | null {
  const reason = classifyDbError(err);
  if (!reason) return null;
  counts[reason] += 1;
  total += 1;
  lastAt = at;
  lastReason = reason;
  return reason;
}

export function getDbIncidents(): DbIncidents {
  return { total, byReason: { ...counts }, lastAt, lastReason };
}

export function resetDbIncidents(): void {
  counts = emptyCounts();
  total = 0;
  lastAt = null;
  lastReason = null;
}
