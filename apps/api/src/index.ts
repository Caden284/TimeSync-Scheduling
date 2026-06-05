// ============================================================
// TimeSync Scheduling — Node.js API Server
// ============================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { employeeRoutes } from './routes/employees';
import { scheduleRoutes } from './routes/schedules';
import { shiftRoutes } from './routes/shifts';
import { ruleRoutes } from './routes/rules';
import { analyticsRoutes } from './routes/analytics';
import { copilotRoutes } from './routes/copilot';
import { authRoutes } from './routes/auth';
import { orgRoutes } from './routes/organizations';
import { webhookRoutes } from './routes/webhooks';
import { prisma } from './lib/db';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';

const app = Fastify({
  logger: false,
  trustProxy: true,
});

async function bootstrap() {
  // Security
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 500,
    timeWindow: '1 minute',
    skipOnError: false,
  });

  // Auth
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: { expiresIn: '24h' },
  });

  // Routes — public
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

  // Routes — authenticated
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', tenantMiddleware);

  await app.register(orgRoutes,       { prefix: '/api/v1/organizations' });
  await app.register(employeeRoutes,  { prefix: '/api/v1/employees' });
  await app.register(scheduleRoutes,  { prefix: '/api/v1/schedules' });
  await app.register(shiftRoutes,     { prefix: '/api/v1/shifts' });
  await app.register(ruleRoutes,      { prefix: '/api/v1/rules' });
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await app.register(copilotRoutes,   { prefix: '/api/v1/copilot' });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  }));

  app.setErrorHandler(errorHandler);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: '0.0.0.0' });
  logger.info(`TimeSync API running on port ${port}`);
}

bootstrap().catch((err) => {
  logger.error(err);
  process.exit(1);
});
