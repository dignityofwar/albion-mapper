import type Database from 'better-sqlite3';
import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
