import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const APPWRITE_ENDPOINT  = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT  ?? 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT   = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? '6a5ac65d000f4a62b039';
const DATABASE_ID        = 'timesync-db';

// ── Appwrite REST helper (server-side, uses API key) ──────────────────────────

async function aw(path: string, method = 'GET', body?: object) {
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!apiKey) throw new Error('APPWRITE_API_KEY not configured.');
  const res = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Project': APPWRITE_PROJECT,
      'X-Appwrite-Key': apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? `Appwrite ${res.status}`);
  return data;
}

function encodeQueries(queries: string[]) {
  return queries.map(q => `queries[]=${encodeURIComponent(q)}`).join('&');
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function toolListUnassignedShifts({ orgId, weekStart, weekEnd }: { orgId: string; weekStart?: string; weekEnd?: string }) {
  const qs = [
    `Query.equal("orgId","${orgId}")`,
    `Query.equal("isOpen","true")`,
    weekStart ? `Query.greaterThanEqual("date","${weekStart}")` : null,
    weekEnd   ? `Query.lessThanEqual("date","${weekEnd}")` : null,
    `Query.limit("100")`,
  ].filter(Boolean);
  const data = await aw(`/databases/${DATABASE_ID}/collections/shifts/documents?${encodeQueries(qs as string[])}`);
  return (data.documents ?? []).map((d: any) => ({
    id: d.$id, date: d.date, startTime: d.startTime, endTime: d.endTime,
    title: d.title ?? 'Shift', department: d.departmentName,
  }));
}

async function toolListEmployeesWithAvailability({ orgId }: { orgId: string }) {
  const qs = [`Query.equal("orgId","${orgId}")`, `Query.equal("isActive","true")`, `Query.limit("200")`];
  const data = await aw(`/databases/${DATABASE_ID}/collections/employees/documents?${encodeQueries(qs)}`);
  return (data.documents ?? []).map((d: any) => {
    let avail: Record<string, any> = {};
    try { avail = JSON.parse(d.weeklyAvailability ?? '{}'); } catch {}
    const availSummary = Object.entries(avail)
      .filter(([, v]: any) => v?.start)
      .map(([k, v]: any) => `${k}: ${v.start}–${v.end}`)
      .join(', ');
    return {
      id: d.$id,
      name: `${d.firstName} ${d.lastName}`,
      role: d.role,
      department: d.departmentName,
      employmentType: d.employmentType,
      availability: availSummary || 'Not set',
    };
  });
}

async function toolAssignShift({ shiftId, employeeId, employeeName }: { shiftId: string; employeeId: string; employeeName: string }) {
  // Get current shift to append to existing assignments
  const shift = await aw(`/databases/${DATABASE_ID}/collections/shifts/documents/${shiftId}`);
  const existingIds: string[]   = shift.assignedEmployeeIds   ?? [];
  const existingNames: string[] = shift.assignedEmployeeNames ?? [];

  if (existingIds.includes(employeeId)) {
    return { success: false, message: `${employeeName} is already assigned to this shift.` };
  }

  await aw(`/databases/${DATABASE_ID}/collections/shifts/documents/${shiftId}`, 'PATCH', {
    data: {
      isOpen: false,
      assignedEmployeeIds:   [...existingIds, employeeId],
      assignedEmployeeNames: [...existingNames, employeeName],
      status: 'scheduled',
    },
  });
  return { success: true, message: `Assigned ${employeeName} to shift on ${shift.date} (${shift.startTime}–${shift.endTime}).` };
}

async function toolCreateShift({ orgId, date, startTime, endTime, title, departmentName, minStaff }: {
  orgId: string; date: string; startTime: string; endTime: string;
  title?: string; departmentName?: string; minStaff?: number;
}) {
  const doc = await aw(`/databases/${DATABASE_ID}/collections/shifts/documents`, 'POST', {
    documentId: 'unique()',
    data: {
      orgId, date, startTime, endTime,
      title: title ?? 'Shift',
      departmentName: departmentName ?? null,
      shiftType: 'fixed', status: 'scheduled', isOpen: true,
      minStaff: minStaff ?? 1,
    },
    permissions: ['read("users")','update("users")','delete("users")'],
  });
  return { id: doc.$id, date, startTime, endTime, title: title ?? 'Shift' };
}

async function toolUnassignShift({ shiftId, employeeId }: { shiftId: string; employeeId: string }) {
  const shift = await aw(`/databases/${DATABASE_ID}/collections/shifts/documents/${shiftId}`);
  const ids:   string[] = (shift.assignedEmployeeIds   ?? []).filter((id: string) => id !== employeeId);
  const names: string[] = (shift.assignedEmployeeNames ?? []);
  // Remove the employee at the matching index
  const idx = (shift.assignedEmployeeIds ?? []).indexOf(employeeId);
  if (idx >= 0) names.splice(idx, 1);

  await aw(`/databases/${DATABASE_ID}/collections/shifts/documents/${shiftId}`, 'PATCH', {
    data: { isOpen: ids.length === 0, assignedEmployeeIds: ids, assignedEmployeeNames: names },
  });
  return { success: true, message: `Employee removed from shift ${shiftId}.` };
}

// ── Tool definitions for Claude ───────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_unassigned_shifts',
    description: 'Returns all open/unfilled shifts for the organization. Optionally filter by date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        orgId:     { type: 'string', description: 'Organization ID' },
        weekStart: { type: 'string', description: 'Optional start date filter yyyy-MM-dd' },
        weekEnd:   { type: 'string', description: 'Optional end date filter yyyy-MM-dd' },
      },
      required: ['orgId'],
    },
  },
  {
    name: 'list_employees_with_availability',
    description: 'Returns all active employees with their name, role, department, and weekly availability schedule.',
    input_schema: {
      type: 'object' as const,
      properties: {
        orgId: { type: 'string', description: 'Organization ID' },
      },
      required: ['orgId'],
    },
  },
  {
    name: 'assign_shift',
    description: 'Assigns an employee to a shift and marks the shift as filled. Use this to actually write assignments to the database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        shiftId:      { type: 'string', description: 'The shift document ID' },
        employeeId:   { type: 'string', description: 'The employee document ID' },
        employeeName: { type: 'string', description: 'Full name of the employee for display' },
      },
      required: ['shiftId', 'employeeId', 'employeeName'],
    },
  },
  {
    name: 'create_shift',
    description: 'Creates a new shift in the database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        orgId:          { type: 'string' },
        date:           { type: 'string', description: 'yyyy-MM-dd' },
        startTime:      { type: 'string', description: 'HH:mm' },
        endTime:        { type: 'string', description: 'HH:mm' },
        title:          { type: 'string' },
        departmentName: { type: 'string' },
        minStaff:       { type: 'number' },
      },
      required: ['orgId', 'date', 'startTime', 'endTime'],
    },
  },
  {
    name: 'unassign_shift',
    description: 'Removes an employee assignment from a shift.',
    input_schema: {
      type: 'object' as const,
      properties: {
        shiftId:    { type: 'string' },
        employeeId: { type: 'string' },
      },
      required: ['shiftId', 'employeeId'],
    },
  },
];

// ── Execute a tool call ───────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  try {
    let result: unknown;
    if      (name === 'list_unassigned_shifts')          result = await toolListUnassignedShifts(input as any);
    else if (name === 'list_employees_with_availability') result = await toolListEmployeesWithAvailability(input as any);
    else if (name === 'assign_shift')                    result = await toolAssignShift(input as any);
    else if (name === 'create_shift')                    result = await toolCreateShift(input as any);
    else if (name === 'unassign_shift')                  result = await toolUnassignShift(input as any);
    else result = { error: `Unknown tool: ${name}` };
    return JSON.stringify(result);
  } catch (e: any) {
    return JSON.stringify({ error: e?.message ?? 'Tool execution failed' });
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

interface RuleContext {
  name: string; description: string; constraintType: 'hard' | 'soft';
  priority: number; weight?: number; ruleType: string;
  parameters?: Record<string, unknown>; isEnabled: boolean;
}

interface RequestBody {
  messages:   { role: 'user' | 'assistant'; content: string }[];
  rules?:     RuleContext[];
  employees?: { name: string; role?: string; department?: string; employmentType?: string; payRate?: string }[];
  shifts?:    { date: string; startTime: string; endTime: string; title?: string; department?: string; status: string }[];
  orgName?:   string;
  orgId?:     string;
  currentDate?: string;
}

function buildSystemPrompt(body: RequestBody): string {
  const { rules = [], employees = [], shifts = [], orgName = 'Your Organization', currentDate, orgId } = body;

  const activeRules = rules.filter(r => r.isEnabled);
  const hardRules   = activeRules.filter(r => r.constraintType === 'hard');
  const softRules   = activeRules.filter(r => r.constraintType === 'soft');

  const rulesSection = activeRules.length > 0 ? `
## ACTIVE SCHEDULING RULES
### Hard Constraints (MUST NEVER be violated):
${hardRules.map((r, i) => `${i+1}. **${r.name}** (P${r.priority}): ${r.description}`).join('\n') || '(none)'}

### Soft Constraints (optimize, may trade off):
${softRules.map((r, i) => `${i+1}. **${r.name}** (${r.weight !== undefined ? `${(r.weight*100).toFixed(0)}%` : '—'}, P${r.priority}): ${r.description}`).join('\n') || '(none)'}
` : '';

  const employeesSection = employees.length > 0 ? `
## EMPLOYEES (${employees.length})
${employees.map(e => `- ${e.name}${e.role ? ` | ${e.role}` : ''}${e.department ? ` | ${e.department}` : ''}${e.employmentType ? ` | ${e.employmentType.replace('_','-')}` : ''}`).join('\n')}
` : '';

  const shiftsSection = shifts.length > 0 ? `
## CURRENT SCHEDULE (${shifts.length} shifts)
${shifts.slice(0,40).map(s => `- ${s.date} ${s.startTime?.slice(0,5)}–${s.endTime?.slice(0,5)} | ${s.title ?? 'Shift'}${s.department ? ` | ${s.department}` : ''} | ${s.status}`).join('\n')}${shifts.length > 40 ? `\n…and ${shifts.length-40} more` : ''}
` : '';

  const toolNote = orgId && process.env.APPWRITE_API_KEY ? `
## TOOLS
You have tools to READ and WRITE the database directly:
- **list_unassigned_shifts(orgId)** — get all open shifts
- **list_employees_with_availability(orgId)** — get employees + their availability
- **assign_shift(shiftId, employeeId, employeeName)** — assign an employee (WRITES to database)
- **create_shift(orgId, date, startTime, endTime, ...)** — create a new shift
- **unassign_shift(shiftId, employeeId)** — remove an assignment

The org ID is: **${orgId}**

When the user asks you to assign shifts, actually DO it — call the tools. Don't just suggest.
` : `
## TOOLS
Tool use is available but requires APPWRITE_API_KEY to be set in the server environment.
`;

  return `You are TimeSync AI Copilot, an expert workforce scheduling assistant for **${orgName}**.
Today's date: ${currentDate ?? new Date().toISOString().split('T')[0]}
${rulesSection}${employeesSection}${shiftsSection}${toolNote}
## RESPONSE STYLE
- Be concise and professional
- Format shift suggestions as: **[Date] [Start–End]: [Title] → [Employee]**
- When you use tools to make assignments, report what you did clearly
- If a hard constraint can't be satisfied, say so explicitly`;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body: RequestBody = await req.json();
  const { messages } = body;
  if (!messages?.length) {
    return new Response(JSON.stringify({ error: 'No messages' }), { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(body);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        // Agentic loop — run up to 6 rounds of tool calls
        let claudeMessages: Anthropic.MessageParam[] = messages.map(m => ({ role: m.role, content: m.content }));
        let round = 0;
        const MAX_ROUNDS = 6;

        while (round < MAX_ROUNDS) {
          round++;
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: systemPrompt,
            tools: TOOLS,
            messages: claudeMessages,
          });

          const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];

          // If no tool calls, stream the text and exit
          if (toolUseBlocks.length === 0 || (response.stop_reason as string) === 'end_turn') {
            const textBlocks = response.content.filter(b => b.type === 'text') as Anthropic.TextBlock[];
            for (const tb of textBlocks) {
              // Stream text in chunks for a live feel
              const words = tb.text.split(' ');
              for (let i = 0; i < words.length; i += 3) {
                send({ text: words.slice(i, i+3).join(' ') + (i+3 < words.length ? ' ' : '') });
                await new Promise(r => setTimeout(r, 8));
              }
            }
            break;
          }

          // Notify client which tools are being called
          for (const tb of toolUseBlocks) {
            send({ tool_action: `Using ${tb.name.replace(/_/g, ' ')}…` });
          }

          // Execute tool calls
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tb of toolUseBlocks) {
            const result = await executeTool(tb.name, tb.input as Record<string, any>);
            send({ tool_action: `✓ ${tb.name.replace(/_/g, ' ')} completed` });
            toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: result });
          }

          // Append assistant turn + tool results to messages
          claudeMessages = [
            ...claudeMessages,
            { role: 'assistant', content: response.content },
            { role: 'user',      content: toolResults },
          ];

          if ((response.stop_reason as string) === 'end_turn') break;
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err: any) {
        send({ error: err?.message ?? 'Unknown error' });
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
