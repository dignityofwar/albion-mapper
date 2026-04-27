import 'dotenv/config';
import { buildApp } from './app.js';
import { db, initDb } from './db.js';
import { startExpiryCleanup } from './expiry.js';

const PORT = parseInt((typeof process !== 'undefined' ? process.env?.['PORT'] : undefined) ?? '3001', 10);
const HOST = (typeof process !== 'undefined' ? process.env?.['HOST'] : undefined) ?? '0.0.0.0';

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
