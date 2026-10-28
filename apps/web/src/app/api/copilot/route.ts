import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireCaller, jsonError, type Caller } from '@/lib/supabase-server';
import { weekRange } from '@/lib/dates';
import { getShift, label, loadEngine, loadTypes, q, shiftsBetween, toEmployee, toRule, toShift, writeAssignments } from '@/lib/engine-server';
import {
  autoFill, checkAssignment, eligibilityLabel, worstSeverity, staffTarget, shiftHours, weekHours, isRuleEnforced, ruleValue, RULE_PARAMS,
  type EngineShift,
} from '@/lib/rule-engine';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tools ────────────────────────────────────────────────────────────────────

async function toolListOpenShifts(caller: Caller, { weekStart, weekEnd }: { weekStart?: string; weekEnd?: string }) {
  let query = caller.client.from('shifts').select().eq('org_id', caller.orgId);
  if (weekStart) query = query.gte('date', weekStart);
  if (weekEnd)   query = query.lte('date', weekEnd);
  const rows = await q(query.order('date').order('start_time').limit(1000));
  const rules = (await q(caller.client.from('scheduling_rules').select().eq('org_id', caller.orgId))).map(toRule);
  return rows.map(toShift)
    .filter((s: EngineShift) => s.assignedEmployeeIds.length < staffTarget(s, rules))
    .slice(0, 100)
    .map((s: EngineShift) => ({
      id: s.id, date: s.date, startTime: s.startTime.slice(0, 5), endTime: s.endTime.slice(0, 5), title: s.title ?? 'Shift',
      assigned: s.assignedEmployeeNames, needs: staffTarget(s, rules) - s.assignedEmployeeIds.length,
    }));
}

async function toolListEmployees(caller: Caller) {
  const [rows, { workerTypes }] = await Promise.all([
    q(caller.client.from('employees').select().eq('org_id', caller.orgId).eq('is_active', true).limit(500)),
    loadTypes(caller),
  ]);
  return rows.map(toEmployee).map(e => {
    const avail = Object.entries(e.weeklyAvailability ?? {})
      .filter(([, v]) => v?.start).map(([k, v]) => `${k}: ${v!.start}–${v!.end}`).join(', ');
    return {
      id: e.id, name: `${e.firstName} ${e.lastName}`, role: e.role, department: e.departmentName,
      workerType: workerTypes.find(w => w.id === e.workerTypeId)?.name ?? 'Not set', availability: avail || 'Not set',
    };
  });
}

// Same planner as the Schedule page's Auto-Schedule button, then saved.
async function toolAutoScheduleWeek(caller: Caller, { weekStart }: { weekStart: string }) {
  const week = weekRange(weekStart);
  const { ctx, employees } = await loadEngine(caller, week.start, week.end);
  const targets = ctx.shifts.filter(s => s.date >= week.start && s.date <= week.end &&
    s.assignedEmployeeIds.length < staffTarget(s, ctx.rules));
  const plan = autoFill(targets, employees, ctx);
  const byId = new Map(ctx.shifts.map(s => [s.id, s]));
  for (let i = 0; i < plan.changes.length; i += 20) {
    await Promise.all(plan.changes.slice(i, i + 20).map(c =>
      writeAssignments(caller, byId.get(c.shiftId)!, c.employeeIds, c.employeeNames)));
  }
  const names = new Map(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));
  return {
    success: true, changed: plan.changes.length > 0,
    week: `${week.start} to ${week.end}`,
    slotsChecked: targets.length,
    peopleAssigned: plan.assignedCount,
    assignments: plan.changes.slice(0, 40).map(c => `${label(byId.get(c.shiftId)!)} → ${c.added.map(id => names.get(id)).join(', ')}`),
    stillOpen: plan.unfilled.slice(0, 40).map(u => `${u.label}: needs ${u.missing} (${u.reason})`),
    stillOpenCount: plan.unfilled.length,
  };
}

// Every active employee's eligibility for one shift, best first.
async function toolFindCoverage(caller: Caller, { shiftId }: { shiftId: string }) {
  const shift = await getShift(caller, shiftId);
  const { ctx, employees } = await loadEngine(caller, shift.date, shift.date);
  const ranked = employees
    .filter(e => !shift.assignedEmployeeIds.includes(e.id))
    .map(e => {
      const conflicts = checkAssignment(shift, e, ctx);
      return {
        employeeId: e.id, name: `${e.firstName} ${e.lastName}`, status: worstSeverity(conflicts),
        hoursThisWeek: weekHours(ctx, e.id, shift.date),
        issues: conflicts.map(c => `${c.severity === 'block' ? 'BLOCKED' : 'warning'}: ${c.message}`),
      };
    })
    .sort((a, b) => ['ok', 'warn', 'block'].indexOf(a.status) - ['ok', 'warn', 'block'].indexOf(b.status) || a.hoursThisWeek - b.hoursThisWeek);
  const task = ctx.taskTypes?.find(t => t.id === shift.taskTypeId);
  return {
    shift: label(shift), task: task ? `${task.name} (who: ${eligibilityLabel(task, ctx.workerTypes)})` : 'none (anyone)',
    needs: staffTarget(shift, ctx.rules) - shift.assignedEmployeeIds.length, candidates: ranked.slice(0, 40),
  };
}

async function toolAssignShift(caller: Caller, { shiftId, employeeId }: { shiftId: string; employeeId: string }) {
  const shift = await getShift(caller, shiftId);
  const { ctx, employees } = await loadEngine(caller, shift.date, shift.date);
  const emp = employees.find(e => e.id === employeeId);
  if (!emp) return { success: false, message: 'Employee not found or inactive.' };
  const name = `${emp.firstName} ${emp.lastName}`;

  // Hard rules are enforced here, not left to the model.
  const conflicts = checkAssignment(shift, emp, ctx);
  const blocks = conflicts.filter(c => c.severity === 'block');
  if (blocks.length) {
    return { success: false, message: `Cannot assign ${name}: ${blocks.map(c => c.message).join(' ')}` };
  }
  await writeAssignments(caller, shift, [...shift.assignedEmployeeIds, emp.id], [...(shift.assignedEmployeeNames ?? []), name]);
  const warnings = conflicts.map(c => c.message);
  return {
    success: true, changed: true,
    message: `Assigned ${name} to ${label(shift)}.${warnings.length ? ` Warnings: ${warnings.join(' ')}` : ''}`,
  };
}

async function toolCreateShift(caller: Caller, { date, startTime, endTime, title, departmentName, minStaff }: {
  date: string; startTime: string; endTime: string; title?: string; departmentName?: string; minStaff?: number;
}) {
  const row = await q<{ id: string }>(caller.client.from('shifts').insert({
    org_id: caller.orgId, date, start_time: startTime, end_time: endTime,
    title: title ?? 'Shift', department_name: departmentName ?? null,
    shift_type: 'fixed', status: 'open', is_open: true, min_staff: minStaff ?? 1,
  }).select('id').single());
  return { success: true, changed: true, id: row.id, date, startTime, endTime, title: title ?? 'Shift' };
}

async function toolUnassignShift(caller: Caller, { shiftId, employeeId }: { shiftId: string; employeeId: string }) {
  const shift = await getShift(caller, shiftId);
  const idx = shift.assignedEmployeeIds.indexOf(employeeId);
  if (idx < 0) return { success: false, message: 'That employee is not on this shift.' };
  const name = shift.assignedEmployeeNames?.[idx] ?? 'Employee';
  await writeAssignments(caller, shift,
    shift.assignedEmployeeIds.filter((_, i) => i !== idx),
    (shift.assignedEmployeeNames ?? []).filter((_, i) => i !== idx));
  return { success: true, changed: true, message: `Removed ${name} from ${label(shift)}.` };
}

// Each tool's input schema; inputs are validated before anything runs.
const INPUTS = {
  list_open_shifts: z.object({ weekStart: z.string().optional(), weekEnd: z.string().optional() }),
  list_employees: z.object({}),
  find_coverage: z.object({ shiftId: z.string() }),
  assign_shift: z.object({ shiftId: z.string(), employeeId: z.string() }),
  create_shift: z.object({
    date: z.string(), startTime: z.string(), endTime: z.string(),
    title: z.string().optional(), departmentName: z.string().optional(), minStaff: z.number().optional(),
  }),
  unassign_shift: z.object({ shiftId: z.string(), employeeId: z.string() }),
  auto_schedule_week: z.object({ weekStart: z.string() }),
};
type ToolName = keyof typeof INPUTS;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'list_open_shifts',
    description: 'Lists shifts that still need staff (fewer people than their minimum), optionally within a date range.',
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
    name: 'list_employees',
    description: 'Lists active employees with their role, department, worker type (e.g. Staff or Student), and weekly availability.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'find_coverage',
    description: 'For one shift, ranks every employee by eligibility using the organization\'s scheduling rules, task eligibility (which worker types or people may do the task), time off, availability, and existing shifts. Status "ok" = no issues, "warn" = soft-rule warnings, "block" = cannot be assigned. Call this before assigning.',
    input_schema: {
      type: 'object' as const,
      properties: { shiftId: { type: 'string' } },
      required: ['shiftId'],
    },
  },
  {
    name: 'assign_shift',
    description: 'Assigns an employee to a shift (writes to the database). Refuses assignments that break a hard rule or the task\'s eligibility and reports any soft-rule warnings.',
    input_schema: {
      type: 'object' as const,
      properties: {
        shiftId:    { type: 'string' },
        employeeId: { type: 'string' },
      },
      required: ['shiftId', 'employeeId'],
    },
  },
  {
    name: 'auto_schedule_week',
    description: 'Staffs every under-staffed shift in one Sunday–Saturday week at once (writes to the database), using the same planner as the Auto-Schedule button: task eligibility, rules, availability, continuous blocks, usual people, fair hours, and breaks for whoever works through them. Use this for "fill the week" requests instead of assigning slots one by one. Returns what was assigned and what stays open, with reasons.',
    input_schema: {
      type: 'object' as const,
      properties: { weekStart: { type: 'string', description: 'Any date in the week, yyyy-MM-dd' } },
      required: ['weekStart'],
    },
  },
  {
    name: 'create_shift',
    description: 'Creates a new unstaffed shift.',
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
    description: 'Removes an employee from a shift.',
    input_schema: {
      type: 'object' as const,
      properties: {
        shiftId:    { type: 'string' },
        employeeId: { type: 'string' },
      },
      required: ['shiftId', 'employeeId'],
    },
  },
].map(t => ({ ...t, eager_input_streaming: true }));   // tool input streams as it's generated; validated below

async function executeTool(caller: Caller, name: string, rawInput: unknown): Promise<{ text: string; changed: boolean; isError?: boolean }> {
  const schema = INPUTS[name as ToolName];
  if (!schema) return { text: JSON.stringify({ error: `Unknown tool: ${name}` }), changed: false, isError: true };
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { text: JSON.stringify({ INVALID_JSON: JSON.stringify(rawInput ?? null) }), changed: false, isError: true };
  }
  const input = parsed.data as any;
  try {
    let result: any;
    if      (name === 'list_open_shifts')   result = await toolListOpenShifts(caller, input);
    else if (name === 'list_employees')     result = await toolListEmployees(caller);
    else if (name === 'find_coverage')      result = await toolFindCoverage(caller, input);
    else if (name === 'assign_shift')       result = await toolAssignShift(caller, input);
    else if (name === 'auto_schedule_week') result = await toolAutoScheduleWeek(caller, input);
    else if (name === 'create_shift')       result = await toolCreateShift(caller, input);
    else                                    result = await toolUnassignShift(caller, input);
    return { text: JSON.stringify(result), changed: !!result?.changed };
  } catch (e: any) {
    return { text: JSON.stringify({ error: e?.message ?? 'Tool execution failed' }), changed: false, isError: true };
  }
}

// ── System prompt (from the database, not the browser) ───────────────────────

async function buildSystemPrompt(caller: Caller, today: string, focusDate: string): Promise<string> {
  const week = weekRange(focusDate);
  const c = caller.client;
  const [org, ruleRows, empRows, shiftRows, { taskTypes, workerTypes }] = await Promise.all([
    q<{ name: string } | null>(c.from('organizations').select('name').eq('id', caller.orgId).maybeSingle()),
    q(c.from('scheduling_rules').select().eq('org_id', caller.orgId).eq('is_enabled', true).order('priority')),
    q(c.from('employees').select().eq('org_id', caller.orgId).eq('is_active', true).limit(300)),
    shiftsBetween(caller, week.start, week.end),
    loadTypes(caller),
  ]);
  const typeName = (id?: string | null) => workerTypes.find(w => w.id === id)?.name;
  const rules = ruleRows.map(toRule);
  const describe = (r: ReturnType<typeof toRule>) => {
    const meta = RULE_PARAMS[r.ruleType];
    const value = meta ? ` (${meta.label}: ${ruleValue(r)} ${meta.unit})` : '';
    const enforced = isRuleEnforced(r.ruleType) ? '' : ' [not automatically checked]';
    return `- **${r.name}**${value}: ${r.description}${enforced}`;
  };
  const hard = rules.filter(r => r.constraintType === 'hard');
  const soft = rules.filter(r => r.constraintType === 'soft');
  const shifts = shiftRows.map(toShift);
  const open = shifts.filter(s => s.assignedEmployeeIds.length < staffTarget(s, rules));
  const SHIFT_LINES = 60;

  return `You are TimeSync AI Copilot, a workforce scheduling assistant for **${org?.name ?? 'this organization'}**.
Today's date: ${today}. The user is looking at the week of ${week.start} to ${week.end}.

## ACTIVE SCHEDULING RULES
Hard rules (assignments that break these are refused by the system):
${hard.map(describe).join('\n') || '(none)'}
Soft rules (avoid breaking; the system reports warnings):
${soft.map(describe).join('\n') || '(none)'}
Approved time off and double-booking always block an assignment.

## EMPLOYEES (${empRows.length})
${empRows.map(toEmployee).map(e => `- ${e.firstName} ${e.lastName}${typeName(e.workerTypeId) ? ` | ${typeName(e.workerTypeId)}` : ''}${e.role ? ` | ${e.role}` : ''}${e.departmentName ? ` | ${e.departmentName}` : ''}`).join('\n') || '(none yet)'}

## TASKS (who may work each)
${taskTypes.map(t => `- ${t.name}${t.isBreak ? ' [break]' : ''}: ${eligibilityLabel(t, workerTypes)}`).join('\n') || '(no tasks defined; anyone can work any shift)'}

## SHIFTS THIS WEEK (${shifts.length} total, ${open.length} need staff)
${(shifts.length > SHIFT_LINES ? open : shifts).slice(0, SHIFT_LINES).map(s => `- ${s.date} ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)} (${shiftHours(s)}h) | ${s.title ?? 'Shift'} | ${s.assignedEmployeeNames?.join(', ') || 'unstaffed'} | needs ${Math.max(0, staffTarget(s, rules) - s.assignedEmployeeIds.length)} more`).join('\n') || '(none)'}${shifts.length > SHIFT_LINES ? `\n(Showing shifts that need staff only. Use list_open_shifts for more.)` : ''}

## TOOLS
Use the tools to read and change the schedule. To fill a whole week, use auto_schedule_week. To staff a single shift, call find_coverage first and pick an "ok" candidate (fewest hours this week) before considering "warn" ones; never try "block" candidates. Only people allowed to do a shift's task can work it. When asked to assign shifts, actually do it rather than only suggesting.

## RESPONSE STYLE
- Be concise and professional.
- Report assignments as: **[Date] [Start–End]: [Shift] → [Employee]**
- If a shift can't be filled without breaking a hard rule, say which rule and why.`;
}

// ── POST handler ─────────────────────────────────────────────────────────────

interface RequestBody {
  messages: { role: 'user' | 'assistant'; content: string }[];
  today?: string;
  focusDate?: string;
}

const isISODate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function POST(req: NextRequest) {
  let caller: Caller;
  try {
    caller = await requireCaller(req);
  } catch (e) {
    return jsonError(e);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 503 });
  }

  const body: RequestBody = await req.json().catch(() => ({ messages: [] }));
  const messages = (body.messages ?? []).filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim());
  if (!messages.length) return Response.json({ error: 'No messages' }, { status: 400 });

  const today = isISODate(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const focusDate = isISODate(body.focusDate) ? body.focusDate : today;

  let systemPrompt: string;
  try {
    systemPrompt = await buildSystemPrompt(caller, today, focusDate);
  } catch (e) {
    return jsonError(e);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        let claudeMessages: Anthropic.Beta.BetaMessageParam[] = messages.map(m => ({ role: m.role, content: m.content }));
        const MAX_ROUNDS = 10;
        let answered = false;
        let parseRetries = 0;

        for (let round = 1; round <= MAX_ROUNDS; round++) {
          let response: Anthropic.Beta.BetaMessage;
          try {
            const stream = anthropic.beta.messages.stream({
              model: 'claude-opus-5-5',
              max_tokens: 64000,
              thinking: { type: 'adaptive' },
              output_config: { effort: 'medium' },
              // A safety decline is retried server-side on the model
              // Anthropic recommends for that refusal category.
              betas: ['server-side-fallback-2026-07-01'],
              fallbacks: 'default' as any,
              system: systemPrompt,
              tools: TOOLS,
              messages: claudeMessages,
            });
            // Text reaches the browser as it's generated.
            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                send({ text: event.delta.text });
                answered = true;
              }
            }
            response = await stream.finalMessage();
          } catch (err) {
            // Unparseable streamed tool input: re-issue the turn (bounded).
            // API errors (auth, rate limit, …) are real failures.
            if (err instanceof Anthropic.APIError || parseRetries >= 2) throw err;
            parseRetries++;
            round--;
            continue;
          }
          parseRetries = 0;

          if (response.stop_reason === 'refusal') {
            if (!answered) send({ text: "I can't help with that request." });
            answered = true;
            break;
          }
          const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
          if (response.stop_reason === 'max_tokens') {
            send({ text: '\n_(Response was cut short — ask me to continue.)_' });
            break;
          }
          if (response.stop_reason !== 'tool_use' || toolUses.length === 0) break;

          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const tb of toolUses) {
            send({ tool_action: `Using ${tb.name.replace(/_/g, ' ')}…` });
            const { text, changed, isError } = await executeTool(caller, tb.name, tb.input);
            if (changed) send({ changed: true });
            results.push({ type: 'tool_result', tool_use_id: tb.id, content: text, ...(isError ? { is_error: true } : {}) });
          }
          // Text between tool calls ends up on its own line in the chat.
          if (answered) send({ text: '\n' });
          claudeMessages = [
            ...claudeMessages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: results },
          ];

          if (round === MAX_ROUNDS) {
            send({ text: "\nI reached my step limit for one request. Ask me to continue and I'll pick up where I left off." });
            answered = true;
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err: any) {
        send({ error: err instanceof Anthropic.APIError ? `The AI service returned an error (${err.status ?? 'network'}). Try again.` : err?.message ?? 'Unknown error' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
