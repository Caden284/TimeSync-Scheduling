import type { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/db';
import { buildScheduleContext } from '../lib/copilot-context';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are TimeSync Copilot, an expert AI scheduling assistant embedded in an enterprise workforce management platform.

You have full access to the current schedule, employee roster, scheduling rules, and organizational configuration for the user's organization.

Your capabilities:
- Generate and optimize schedules using constraint-based logic
- Find qualified employees for open shifts
- Analyze labor costs, overtime, coverage gaps
- Explain every AI scheduling decision with full reasoning
- Make bulk schedule edits through natural language
- Check compliance with labor laws and organizational rules
- Forecast staffing needs and costs

Context format: You will receive a JSON context block containing the current schedule state, employee pool, and active rules.

When making schedule changes, output structured action blocks using this format:
<action type="ASSIGN_SHIFT" shiftId="..." employeeId="..." reason="..."/>
<action type="UNASSIGN_SHIFT" shiftId="..." employeeId="..."/>
<action type="CREATE_SHIFT" date="..." startTime="..." endTime="..." deptId="..." roleId="..."/>

Always explain your reasoning. Be specific about WHY each employee was chosen or not chosen. Cite rule names when relevant.

If a request would violate a hard constraint, explain the violation clearly and suggest alternatives.

Keep responses concise and actionable. Lead with the result, then explain reasoning.`;

export async function copilotRoutes(app: FastifyInstance) {
  // Create or continue conversation
  app.post('/conversations', async (req, reply) => {
    const { orgId, userId } = req.user;
    const { scheduleId, message } = req.body as { scheduleId?: string; message: string };

    // Build schedule context
    const context = await buildScheduleContext(orgId, scheduleId);

    // Create conversation
    const conversation = await prisma.copilotConversation.create({
      data: {
        orgId,
        userId,
        scheduleId,
        title: message.slice(0, 80),
        messages: [{
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        }],
        contextSnapshot: context,
      },
    });

    // Stream response
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `<context>${JSON.stringify(context, null, 2)}</context>\n\n${message}`,
        },
      ],
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        fullResponse += text;
        reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', text, conversationId: conversation.id })}\n\n`);
      }
    }

    // Parse and apply actions from response
    const actions = parseActions(fullResponse);

    // Save assistant message
    await prisma.copilotConversation.update({
      where: { id: conversation.id },
      data: {
        messages: {
          push: {
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString(),
            actions,
          },
        },
      },
    });

    reply.raw.write(`data: ${JSON.stringify({ type: 'done', actions, conversationId: conversation.id })}\n\n`);
    reply.raw.end();
  });

  // Continue conversation
  app.post('/conversations/:id/messages', async (req, reply) => {
    const { orgId, userId } = req.user;
    const { id } = req.params as { id: string };
    const { message } = req.body as { message: string };

    const conversation = await prisma.copilotConversation.findFirst({
      where: { id, orgId },
    });
    if (!conversation) return reply.status(404).send({ error: 'Conversation not found' });

    // Rebuild context (schedule may have changed)
    const context = await buildScheduleContext(orgId, conversation.scheduleId ?? undefined);

    // Build message history for Claude
    const history = (conversation.messages as any[]).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    history.push({ role: 'user', content: message });

    // Save user message
    await prisma.copilotConversation.update({
      where: { id },
      data: {
        messages: {
          push: { role: 'user', content: message, timestamp: new Date().toISOString() },
        },
        updatedAt: new Date(),
      },
    });

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT + `\n\n<context>${JSON.stringify(context)}</context>`,
      messages: history,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullResponse += chunk.delta.text;
        reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk.delta.text })}\n\n`);
      }
    }

    const actions = parseActions(fullResponse);
    await prisma.copilotConversation.update({
      where: { id },
      data: {
        messages: {
          push: { role: 'assistant', content: fullResponse, timestamp: new Date().toISOString(), actions },
        },
      },
    });

    reply.raw.write(`data: ${JSON.stringify({ type: 'done', actions })}\n\n`);
    reply.raw.end();
  });

  // Execute actions from copilot response
  app.post('/conversations/:id/execute', async (req, reply) => {
    const { orgId } = req.user;
    const { actions } = req.body as { actions: CopilotAction[] };
    const results = await executeActions(actions, orgId);
    return { data: results };
  });

  // List conversations
  app.get('/conversations', async (req) => {
    const { orgId, userId } = req.user;
    const conversations = await prisma.copilotConversation.findMany({
      where: { orgId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, title: true, updatedAt: true, scheduleId: true },
    });
    return { data: conversations };
  });
}

interface CopilotAction {
  type: string;
  shiftId?: string;
  employeeId?: string;
  reason?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  deptId?: string;
  roleId?: string;
}

function parseActions(text: string): CopilotAction[] {
  const actions: CopilotAction[] = [];
  const regex = /<action\s([^/]+)\/>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const attrs: Record<string, string> = {};
    match[1].replace(/(\w+)="([^"]+)"/g, (_, k, v) => { attrs[k] = v; return _; });
    if (attrs.type) actions.push(attrs as CopilotAction);
  }
  return actions;
}

async function executeActions(actions: CopilotAction[], orgId: string) {
  const results = [];
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'ASSIGN_SHIFT':
          if (action.shiftId && action.employeeId) {
            await prisma.shiftAssignment.upsert({
              where: { shiftId_employeeId: { shiftId: action.shiftId, employeeId: action.employeeId } },
              create: {
                shiftId: action.shiftId,
                employeeId: action.employeeId,
                orgId,
                status: 'assigned',
                assignedBy: 'ai',
              },
              update: { status: 'assigned' },
            });
          }
          results.push({ action: action.type, status: 'success' });
          break;
        default:
          results.push({ action: action.type, status: 'unsupported' });
      }
    } catch (err) {
      results.push({ action: action.type, status: 'error', error: String(err) });
    }
  }
  return results;
}
