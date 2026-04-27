import 'dotenv/config';
import { buildApp } from './app.js';
import { db, initDb } from './db.js';
import { startExpiryCleanup } from './expiry.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function main() {
  try {
    await initDb();
    console.log('Database initialized');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }

  const app = await buildApp({ db, logger: true });

  const cleanup = startExpiryCleanup(db);

  app.addHook('onClose', async () => {
    clearInterval(cleanup);
    await db.end();
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
