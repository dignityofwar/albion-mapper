import { beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

export function setupTestApp() {
    const context: {
        app: FastifyInstance | undefined;
        roomId: string;
        token: string | undefined;
        mockDb: any;
    } = {
        app: undefined,
        roomId: 'test-room-id',
        token: undefined,
        mockDb: undefined
    };

    beforeEach(async () => {
        context.mockDb = {
            query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
            connect: vi.fn().mockResolvedValue({
              query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
              release: vi.fn(),
            }),
        };
        context.app = await buildApp({ db: context.mockDb, disableRateLimit: true, jwtSecret: 'test-secret' });
        await context.app.ready();

        context.token = context.app.jwt.sign({ roomId: context.roomId });
    });

    afterEach(async () => {
        if (context.app) {
            await context.app.close();
        }
    });

    return context;
}
