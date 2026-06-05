import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { publishEvent } from '../lib/events';
import { schedulerClient } from '../lib/scheduler-client';

const GenerateParamsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departmentIds: z.array(z.string().uuid()).optional(),
  locationIds: z.array(z.string().uuid()).optional(),
  optimizationGoals: z.array(z.enum([
    'minimize_cost', 'maximize_coverage', 'maximize_fairness',
    'minimize_overtime', 'maximize_preference',
  ])).default(['maximize_coverage', 'minimize_cost', 'maximize_fairness']),
  maxRuntime: z.number().int().min(5).max(120).default(30),
});

export async function scheduleRoutes(app: FastifyInstance) {
  // List schedules
  app.get('/', async (req) => {
    const { orgId } = req.user;
    const schedules = await prisma.schedule.findMany({
      where: { orgId },
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { shifts: true } },
      },
    });
    return { data: schedules };
  });

  // Get schedule by ID
  app.get('/:id', async (req, reply) => {
    const { orgId } = req.user;
    const { id } = req.params as { id: string };
    const schedule = await prisma.schedule.findFirst({
      where: { id, orgId },
      include: {
        shifts: {
          include: {
            assignments: {
              include: { employee: true },
            },
            department: true,
            role: true,
            location: true,
          },
        },
      },
    });
    if (!schedule) return reply.status(404).send({ error: 'Schedule not found' });
    return { data: schedule };
  });

  // Create schedule (manual)
  app.post('/', async (req, reply) => {
    const { orgId, userId } = req.user;
    const body = req.body as { name: string; startDate: string; endDate: string; description?: string };
    const schedule = await prisma.schedule.create({
      data: {
        orgId,
        name: body.name,
        description: body.description,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: 'draft',
        generatedBy: 'manual',
        createdById: userId,
      },
    });
    return reply.status(201).send({ data: schedule });
  });

  // Trigger AI generation
  app.post('/:id/generate', async (req, reply) => {
    const { orgId, userId } = req.user;
    const { id } = req.params as { id: string };
    const params = GenerateParamsSchema.parse(req.body);

    // Verify schedule belongs to org
    const schedule = await prisma.schedule.findFirst({ where: { id, orgId } });
    if (!schedule) return reply.status(404).send({ error: 'Schedule not found' });

    // Create generation job
    const job = await prisma.aiGenerationJob.create({
      data: {
        orgId,
        scheduleId: id,
        status: 'queued',
        inputParams: params,
        createdById: userId,
      },
    });

    // Update schedule status
    await prisma.schedule.update({
      where: { id },
      data: { status: 'generating' },
    });

    // Dispatch to scheduler microservice (async)
    schedulerClient.enqueue({
      jobId: job.id,
      orgId,
      scheduleId: id,
      ...params,
    }).catch(console.error);

    // Publish real-time event
    await publishEvent('schedule.generation_started', { orgId, scheduleId: id, jobId: job.id });

    return reply.status(202).send({ data: job });
  });

  // Get generation job status
  app.get('/jobs/:jobId', async (req, reply) => {
    const { orgId } = req.user;
    const { jobId } = req.params as { jobId: string };
    const job = await prisma.aiGenerationJob.findFirst({
      where: { id: jobId, orgId },
    });
    if (!job) return reply.status(404).send({ error: 'Job not found' });
    return { data: job };
  });

  // Publish schedule
  app.post('/:id/publish', async (req, reply) => {
    const { orgId, userId } = req.user;
    const { id } = req.params as { id: string };

    const schedule = await prisma.schedule.findFirst({
      where: { id, orgId },
      include: { _count: { select: { shifts: true } } },
    });
    if (!schedule) return reply.status(404).send({ error: 'Schedule not found' });

    const updated = await prisma.schedule.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        publishedById: userId,
        version: { increment: 1 },
      },
    });

    // Notify all assigned employees
    await publishEvent('schedule.published', {
      orgId,
      scheduleId: id,
      scheduleName: schedule.name,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
    });

    return { data: updated };
  });

  // Archive schedule
  app.post('/:id/archive', async (req, reply) => {
    const { orgId } = req.user;
    const { id } = req.params as { id: string };
    const updated = await prisma.schedule.update({
      where: { id },
      data: { status: 'archived' },
    });
    return { data: updated };
  });
}
