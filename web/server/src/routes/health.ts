import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_request, reply) => {
    const { rows } = await app.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM rooms'
    );
    return reply.send({ status: 'ok', roomCount: parseInt(rows[0].count, 10) });
  });
}
