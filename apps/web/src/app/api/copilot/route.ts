import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface RuleContext {
  name: string;
  description: string;
  constraintType: 'hard' | 'soft';
  priority: number;
  weight?: number;
  ruleType: string;
  parameters?: Record<string, unknown>;
  isEnabled: boolean;
}

interface RequestBody {
  messages: { role: 'user' | 'assistant'; content: string }[];
  rules?: RuleContext[];
  employees?: { name: string; role?: string; department?: string; employmentType?: string; payRate?: string }[];
  shifts?: { date: string; startTime: string; endTime: string; title?: string; department?: string; status: string }[];
  orgName?: string;
  currentDate?: string;
}

function buildSystemPrompt(body: RequestBody): string {
  const { rules = [], employees = [], shifts = [], orgName = 'Your Organization', currentDate } = body;

  const activeRules = rules.filter(r => r.isEnabled);
  const hardRules  = activeRules.filter(r => r.constraintType === 'hard');
  const softRules  = activeRules.filter(r => r.constraintType === 'soft');

  const rulesSection = activeRules.length > 0 ? `
## ACTIVE SCHEDULING RULES

### Hard Constraints (MUST NEVER be violated — if a constraint can't be satisfied, flag it):
${hardRules.length > 0
  ? hardRules.map((r, i) => `${i + 1}. **${r.name}** (Priority P${r.priority}): ${r.description}${
      r.parameters && Object.keys(r.parameters).length > 0
        ? ` [${Object.entries(r.parameters).map(([k,v]) => `${k}: ${v}`).join(', ')}]`
        : ''
    }`).join('\n')
  : '(none configured)'}

### Soft Constraints (Optimize for these — trade off only when unavoidable):
${softRules.length > 0
  ? softRules.map((r, i) => `${i + 1}. **${r.name}** (Weight: ${r.weight !== undefined ? `${(r.weight * 100).toFixed(0)}%` : '—'}, Priority P${r.priority}): ${r.description}`).join('\n')
  : '(none configured)'}
` : `
## SCHEDULING RULES
No rules configured yet. Apply sensible defaults: honor employee availability, avoid back-to-back shifts without adequate rest, don't exceed 40 hours/week without noting overtime.
`;

  const employeesSection = employees.length > 0 ? `
## CURRENT EMPLOYEES (${employees.length} total)
${employees.map(e => `- ${e.name}${e.role ? ` | ${e.role}` : ''}${e.department ? ` | ${e.department}` : ''}${e.employmentType ? ` | ${e.employmentType.replace('_', '-')}` : ''}${e.payRate ? ` | $${e.payRate}/hr` : ''}`).join('\n')}
` : `
## EMPLOYEES
No employees loaded yet. Remind the user to add employees on the Employees page first.
`;

  const shiftsSection = shifts.length > 0 ? `
## CURRENT SCHEDULE (${shifts.length} shifts this period)
${shifts.slice(0, 40).map(s => `- ${s.date} ${s.startTime?.slice(0,5)}–${s.endTime?.slice(0,5)} | ${s.title ?? 'Shift'}${s.department ? ` | ${s.department}` : ''} | ${s.status}`).join('\n')}${shifts.length > 40 ? `\n…and ${shifts.length - 40} more shifts` : ''}
` : `
## CURRENT SCHEDULE
No shifts scheduled yet for this period.
`;

  return `You are TimeSync AI Copilot, an expert workforce scheduling assistant for **${orgName}**.

Today's date: ${currentDate ?? new Date().toISOString().split('T')[0]}

Your role:
- Generate, optimize, and explain work schedules
- Find coverage for open or uncovered shifts
- Analyze labor costs, overtime risk, and compliance
- Answer questions about the current schedule and employees
- Apply all active scheduling rules precisely
- Be concise but thorough — this is a professional scheduling tool
${rulesSection}${employeesSection}${shiftsSection}
## INSTRUCTIONS
- When generating schedules, list specific shifts with date, time, employee name, and department
- When you can't satisfy a hard constraint, say so clearly and explain why
- Format shift suggestions as: **[Date] [Start–End]: [Title] → [Employee] ([Dept])**
- Use markdown for lists, bold headings, and tables when helpful
- If asked to "generate a schedule," create concrete shift entries covering the requested period
- Always respect hard constraints — never propose a schedule that violates them
- When trade-offs exist, explain which soft constraints were deprioritized and why`;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured. Add it to .env.local to enable AI.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body: RequestBody = await req.json();
  const { messages } = body;

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(body);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const chunk = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err: any) {
        const errMsg = `data: ${JSON.stringify({ error: err?.message ?? 'Unknown error' })}\n\n`;
        controller.enqueue(encoder.encode(errMsg));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
