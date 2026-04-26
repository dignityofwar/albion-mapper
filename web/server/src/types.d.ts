import { Pool } from 'pg';
import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
