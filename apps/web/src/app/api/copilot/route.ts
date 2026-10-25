import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { requireCaller, jsonError, type Caller } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tool implementations ──────────────────────────────────────────────────────
// Every tool runs as the signed-in caller, scoped to the caller's organization,
// so Row Level Security applies: staff can read but writes require an admin.

async function toolListUnassignedShifts(caller: Caller, { weekStart, weekEnd }: { weekStart?: string; weekEnd?: string }) {
  let q = caller.client.from('shifts')
    .select('id, date, start_time, end_time, title, department_name')
    .eq('org_id', caller.orgId).eq('is_open', true);
  if (weekStart) q = q.gte('date', weekStart);
  if (weekEnd)   q = q.lte('date', weekEnd);
  const { data, error } = await q.order('date').limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map(d => ({
    id: d.id, date: d.date, startTime: d.start_time, endTime: d.end_time,
    title: d.title ?? 'Shift', department: d.department_name,
  }));
}

async function toolListEmployeesWithAvailability(caller: Caller) {
  const { data, error } = await caller.client.from('employees')
    .select('id, first_name, last_name, role, department_name, employment_type, weekly_availability')
    .eq('org_id', caller.orgId).eq('is_active', true).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(d => {
    const avail: Record<string, any> = d.weekly_availability ?? {};
    const availSummary = Object.entries(avail)
      .filter(([, v]: any) => v?.start)
      .map(([k, v]: any) => `${k}: ${v.start}–${v.end}`)
      .join(', ');
    return {
      id: d.id,
      name: `${d.first_name} ${d.last_name}`,
      role: d.role,
      department: d.department_name,
      employmentType: d.employment_type,
      availability: availSummary || 'Not set',
    };
  });
}

async function getOrgShift(caller: Caller, shiftId: string) {
  const { data, error } = await caller.client.from('shifts')
    .select('id, date, start_time, end_time, assigned_employee_ids, assigned_employee_names')
    .eq('id', shiftId).eq('org_id', caller.orgId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Shift ${shiftId} not found.`);
  return data;
}

async function toolAssignShift(caller: Caller, { shiftId, employeeId, employeeName }: { shiftId: string; employeeId: string; employeeName: string }) {
  const shift = await getOrgShift(caller, shiftId);
  const existingIds: string[]   = shift.assigned_employee_ids   ?? [];
  const existingNames: string[] = shift.assigned_employee_names ?? [];

  if (existingIds.includes(employeeId)) {
    return { success: false, message: `${employeeName} is already assigned to this shift.` };
  }

  const { error } = await caller.client.from('shifts').update({
    is_open: false,
    assigned_employee_ids:   [...existingIds, employeeId],
    assigned_employee_names: [...existingNames, employeeName],
    status: 'scheduled',
  }).eq('id', shiftId).eq('org_id', caller.orgId).select('id').single();
  if (error) throw new Error(error.message);
  return { success: true, message: `Assigned ${employeeName} to shift on ${shift.date} (${shift.start_time}–${shift.end_time}).` };
}

async function toolCreateShift(caller: Caller, { date, startTime, endTime, title, departmentName, minStaff }: {
  date: string; startTime: string; endTime: string;
  title?: string; departmentName?: string; minStaff?: number;
}) {
  const { data, error } = await caller.client.from('shifts').insert({
    org_id: caller.orgId, date, start_time: startTime, end_time: endTime,
    title: title ?? 'Shift',
    department_name: departmentName ?? null,
    shift_type: 'fixed', status: 'scheduled', is_open: true,
    min_staff: minStaff ?? 1,
  }).select('id').single();
  if (error) throw new Error(error.message);
  return { id: data.id, date, startTime, endTime, title: title ?? 'Shift' };
}

async function toolUnassignShift(caller: Caller, { shiftId, employeeId }: { shiftId: string; employeeId: string }) {
  const shift = await getOrgShift(caller, shiftId);
  const ids:   string[] = (shift.assigned_employee_ids   ?? []).filter((id: string) => id !== employeeId);
  const names: string[] = (shift.assigned_employee_names ?? []);
  // Remove the employee at the matching index
  const idx = (shift.assigned_employee_ids ?? []).indexOf(employeeId);
  if (idx >= 0) names.splice(idx, 1);

  const { error } = await caller.client.from('shifts')
    .update({ is_open: ids.length === 0, assigned_employee_ids: ids, assigned_employee_names: names })
    .eq('id', shiftId).eq('org_id', caller.orgId).select('id').single();
  if (error) throw new Error(error.message);
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
        weekStart: { type: 'string', description: 'Optional start date filter yyyy-MM-dd' },
        weekEnd:   { type: 'string', description: 'Optional end date filter yyyy-MM-dd' },
      },
      required: [],
    },
  },
  {
    name: 'list_employees_with_availability',
    description: 'Returns all active employees with their name, role, department, and weekly availability schedule.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
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
        date:           { type: 'string', description: 'yyyy-MM-dd' },
        startTime:      { type: 'string', description: 'HH:mm' },
        endTime:        { type: 'string', description: 'HH:mm' },
        title:          { type: 'string' },
        departmentName: { type: 'string' },
        minStaff:       { type: 'number' },
      },
      required: ['date', 'startTime', 'endTime'],
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

async function executeTool(caller: Caller, name: string, input: Record<string, any>): Promise<string> {
  try {
    let result: unknown;
    if      (name === 'list_unassigned_shifts')          result = await toolListUnassignedShifts(caller, input as any);
    else if (name === 'list_employees_with_availability') result = await toolListEmployeesWithAvailability(caller);
    else if (name === 'assign_shift')                    result = await toolAssignShift(caller, input as any);
    else if (name === 'create_shift')                    result = await toolCreateShift(caller, input as any);
    else if (name === 'unassign_shift')                  result = await toolUnassignShift(caller, input as any);
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
  currentDate?: string;
}

function buildSystemPrompt(body: RequestBody): string {
  const { rules = [], employees = [], shifts = [], orgName = 'Your Organization', currentDate } = body;

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

  const toolNote = `
## TOOLS
You have tools to READ and WRITE this organization's database directly:
- **list_unassigned_shifts()** — get all open shifts
- **list_employees_with_availability()** — get employees + their availability
- **assign_shift(shiftId, employeeId, employeeName)** — assign an employee (WRITES to database)
- **create_shift(date, startTime, endTime, ...)** — create a new shift
- **unassign_shift(shiftId, employeeId)** — remove an assignment

When the user asks you to assign shifts, actually DO it — call the tools. Don't just suggest.
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
  let caller: Caller;
  try {
    caller = await requireCaller(req);
  } catch (e) {
    return jsonError(e);
  }

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
            const result = await executeTool(caller, tb.name, tb.input as Record<string, any>);
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
