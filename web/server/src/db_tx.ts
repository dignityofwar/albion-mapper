/**
 * Rolls back without ever masking the error that caused the rollback.
 *
 * A failure mid-transaction often means the connection itself is gone — a
 * terminated backend, a statement or idle-in-transaction timeout — and the
 * ROLLBACK then throws too. Awaiting it bare in a catch block replaces the real
 * error with a far less useful one, so the cause of the incident is lost exactly
 * when it is most needed.
 */
export async function safeRollback(client: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch (rollbackError) {
    console.error('ROLLBACK failed (original error is being rethrown):', rollbackError);
  }
}
