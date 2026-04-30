import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { Pool } from 'pg';
import { roomRoutes } from './routes/rooms.js';
import { connectionRoutes } from './routes/connections.js';
import { wsRoutes } from './ws.js';

export interface AppOptions {
  db: Pool;
  jwtSecret?: string;
  logger?: boolean;
  disableRateLimit?: boolean;
}

export async function buildApp(options: AppOptions) {
  const {
    db,
    jwtSecret = (typeof process !== 'undefined' ? process.env?.['JWT_SECRET'] : undefined) ?? 'change-me-in-production',
    logger = false,
    disableRateLimit = false,
  } = options;

  const app = Fastify({ logger });

  // CORS
  await app.register(fastifyCors, {
    origin: [
      'https://roadmap.dignityofwar.com',
      'https://roadmap-test.dignityofwar.com',
      'https://roadmap-api-test.dignityofwar.com',
      'https://albion-mapper-client.vercel.app',
      'http://10.0.5.2',
      'https://10.0.5.2',
      /^http:\/\/localhost(:\d+)?$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

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
