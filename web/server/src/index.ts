import { buildApp } from './app.js';
import { getDb } from './db.js';
import { startExpiryCleanup } from './expiry.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function main() {
  const db = getDb();
  const app = await buildApp({ db, logger: true });

  const cleanup = startExpiryCleanup(db);

  app.addHook('onClose', () => {
    clearInterval(cleanup);
    db.close();
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`Server listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
