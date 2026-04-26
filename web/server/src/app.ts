import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import type Database from 'better-sqlite3';
import { roomRoutes } from './routes/rooms.js';
import { connectionRoutes } from './routes/connections.js';
import { wsRoutes } from './ws.js';

export interface AppOptions {
  db: Database.Database;
  jwtSecret?: string;
  logger?: boolean;
  disableRateLimit?: boolean;
}

export async function buildApp(options: AppOptions) {
  const {
    db,
    jwtSecret = process.env['JWT_SECRET'] ?? 'change-me-in-production',
    logger = false,
    disableRateLimit = false,
  } = options;

  const app = Fastify({ logger });

  // Decorate with db
  app.decorate('db', db);

  // JWT
  await app.register(fastifyJwt, { secret: jwtSecret });

  // Authenticate helper
  app.decorate(
    'authenticate',
    async function (
      request: Parameters<(typeof app)['authenticate']>[0],
      reply: Parameters<(typeof app)['authenticate']>[1],
    ) {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  );

  // Rate limiting
  if (!disableRateLimit) {
    await app.register(fastifyRateLimit, { global: false });
  }

  // WebSocket
  await app.register(fastifyWebsocket);

  // Route plugins
  await app.register(roomRoutes, { prefix: '' });
  await app.register(connectionRoutes, { prefix: '' });
  await app.register(wsRoutes, { prefix: '' });

  return app;
}
