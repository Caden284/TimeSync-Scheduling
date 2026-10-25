import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { requireCaller, jsonError, type Caller } from '@/lib/supabase-server';
import { addDaysISO, weekRange } from '@/lib/dates';
import {
  checkAssignment, worstSeverity, staffTarget, shiftHours, weekHours, isRuleEnforced, ruleValue, RULE_PARAMS,
  type EngineContext, type EngineEmployee, type EngineShift, type EngineRule,
} from '@/lib/rule-engine';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Loading the caller's data (runs as the caller, so RLS applies) ───────────

const toShift = (r: any): EngineShift => ({
  id: r.id, date: r.date, startTime: r.start_time, endTime: r.end_time, title: r.title,
  departmentId: r.department_id, locationId: r.location_id, minStaff: r.min_staff, maxStaff: r.max_staff,
  assignedEmployeeIds: r.assigned_employee_ids ?? [], assignedEmployeeNames: r.assigned_employee_names ?? [],
});

const toEmployee = (r: any): EngineEmployee & { departmentName?: string; employmentType?: string } => ({
  id: r.id, firstName: r.first_name, lastName: r.last_name, role: r.role, isActive: r.is_active,
  weeklyAvailability: r.weekly_availability, departmentName: r.department_name, employmentType: r.employment_type,
});

const toRule = (r: any): EngineRule & { description: string; priority: number } => ({
  name: r.name, ruleType: r.rule_type, constraintType: r.constraint_type, isEnabled: r.is_enabled,
  parameters: r.parameters, scopeDepts: r.scope_depts, scopeLocations: r.scope_locations, scopeRoles: r.scope_roles,
  description: r.description, priority: r.priority,
});

async function q<T = any>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// Rules engine context for shifts between `from` and `to` (plus a week each side).
async function loadEngine(caller: Caller, from: string, to: string) {
  const c = caller.client;
  const wFrom = addDaysISO(from, -7), wTo = addDaysISO(to, 7);
  const [shifts, employees, rules, timeOff, overrides] = await Promise.all([
    q(c.from('shifts').select().eq('org_id', caller.orgId).gte('date', wFrom).lte('date', wTo)),
    q(c.from('employees').select().eq('org_id', caller.orgId).eq('is_active', true).limit(500)),
    q(c.from('scheduling_rules').select().eq('org_id', caller.orgId)),
    q(c.from('time_off_requests').select().eq('org_id', caller.orgId).neq('status', 'denied').lte('start_date', wTo).gte('end_date', wFrom)),
    q(c.from('availability_overrides').select().eq('org_id', caller.orgId).gte('date', wFrom).lte('date', wTo)),
  ]);
  const ctx: EngineContext = {
    shifts: shifts.map(toShift),
    rules: rules.map(toRule),
    timeOff: timeOff.map((t: any) => ({ employeeId: t.employee_id, startDate: t.start_date, endDate: t.end_date, status: t.status, leaveType: t.leave_type })),
    overrides: overrides.map((o: any) => ({ employeeId: o.employee_id, date: o.date, isAvailable: o.is_available, altStartTime: o.alt_start_time, altEndTime: o.alt_end_time, reason: o.reason })),
  };
  return { ctx, employees: employees.map(toEmployee) };
}

async function getShift(caller: Caller, shiftId: string): Promise<EngineShift> {
  const row = await q(caller.client.from('shifts').select().eq('id', shiftId).eq('org_id', caller.orgId).maybeSingle());
  if (!row) throw new Error(`Shift ${shiftId} not found.`);
  return toShift(row);
}

async function writeAssignments(caller: Caller, shift: EngineShift, ids: string[], names: string[]) {
  const isOpen = ids.length < Math.max(1, shift.minStaff ?? 1);
  await q(caller.client.from('shifts').update({
    assigned_employee_ids: ids, assigned_employee_names: names,
    is_open: isOpen, status: isOpen ? 'open' : 'scheduled',
  }).eq('id', shift.id).eq('org_id', caller.orgId).select('id').single());
}

const label = (s: EngineShift) => `${s.title || 'Shift'} on ${s.date} ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`;

// ── Tools ────────────────────────────────────────────────────────────────────

async function toolListOpenShifts(caller: Caller, { weekStart, weekEnd }: { weekStart?: string; weekEnd?: string }) {
  let query = caller.client.from('shifts').select().eq('org_id', caller.orgId);
  if (weekStart) query = query.gte('date', weekStart);
  if (weekEnd)   query = query.lte('date', weekEnd);
  const rows = await q(query.order('date').order('start_time').limit(300));
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
  const rows = await q(caller.client.from('employees').select().eq('org_id', caller.orgId).eq('is_active', true).limit(300));
  return rows.map(toEmployee).map(e => {
    const avail = Object.entries(e.weeklyAvailability ?? {})
      .filter(([, v]) => v?.start).map(([k, v]) => `${k}: ${v!.start}–${v!.end}`).join(', ');
    return { id: e.id, name: `${e.firstName} ${e.lastName}`, role: e.role, department: e.departmentName, availability: avail || 'Not set' };
  });
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
  return { shift: label(shift), needs: staffTarget(shift, ctx.rules) - shift.assignedEmployeeIds.length, candidates: ranked };
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

const TOOLS: Anthropic.Tool[] = [
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
    description: 'Lists active employees with their role, department, and weekly availability.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'find_coverage',
    description: 'For one shift, ranks every employee by eligibility using the organization\'s scheduling rules, time off, availability, and existing shifts. Status "ok" = no issues, "warn" = soft-rule warnings, "block" = cannot be assigned. Call this before assigning.',
    input_schema: {
      type: 'object' as const,
      properties: { shiftId: { type: 'string' } },
      required: ['shiftId'],
    },
  },
  {
    name: 'assign_shift',
    description: 'Assigns an employee to a shift (writes to the database). Refuses assignments that break a hard rule and reports any soft-rule warnings.',
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
];

async function executeTool(caller: Caller, name: string, input: Record<string, any>): Promise<{ text: string; changed: boolean }> {
  try {
    let result: any;
    if      (name === 'list_open_shifts') result = await toolListOpenShifts(caller, input);
    else if (name === 'list_employees')   result = await toolListEmployees(caller);
    else if (name === 'find_coverage')    result = await toolFindCoverage(caller, input as any);
    else if (name === 'assign_shift')     result = await toolAssignShift(caller, input as any);
    else if (name === 'create_shift')     result = await toolCreateShift(caller, input as any);
    else if (name === 'unassign_shift')   result = await toolUnassignShift(caller, input as any);
    else result = { error: `Unknown tool: ${name}` };
    return { text: JSON.stringify(result), changed: !!result?.changed };
  } catch (e: any) {
    return { text: JSON.stringify({ error: e?.message ?? 'Tool execution failed' }), changed: false };
  }
}

// ── System prompt (from the database, not the browser) ───────────────────────

async function buildSystemPrompt(caller: Caller, today: string, focusDate: string): Promise<string> {
  const week = weekRange(focusDate);
  const c = caller.client;
  const [org, ruleRows, empRows, shiftRows] = await Promise.all([
    q<{ name: string } | null>(c.from('organizations').select('name').eq('id', caller.orgId).maybeSingle()),
    q(c.from('scheduling_rules').select().eq('org_id', caller.orgId).eq('is_enabled', true).order('priority')),
    q(c.from('employees').select().eq('org_id', caller.orgId).eq('is_active', true).limit(200)),
    q(c.from('shifts').select().eq('org_id', caller.orgId).gte('date', week.start).lte('date', week.end).order('date').order('start_time')),
  ]);
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

  return `You are TimeSync AI Copilot, a workforce scheduling assistant for **${org?.name ?? 'this organization'}**.
Today's date: ${today}. The user is looking at the week of ${week.start} to ${week.end}.

## ACTIVE SCHEDULING RULES
Hard rules (assignments that break these are refused by the system):
${hard.map(describe).join('\n') || '(none)'}
Soft rules (avoid breaking; the system reports warnings):
${soft.map(describe).join('\n') || '(none)'}
Approved time off and double-booking always block an assignment.

## EMPLOYEES (${empRows.length})
${empRows.map(toEmployee).map(e => `- ${e.firstName} ${e.lastName}${e.role ? ` | ${e.role}` : ''}${e.departmentName ? ` | ${e.departmentName}` : ''}${e.employmentType ? ` | ${e.employmentType.replace('_', '-')}` : ''}`).join('\n') || '(none yet)'}

## SHIFTS THIS WEEK (${shifts.length})
${shifts.slice(0, 60).map(s => `- ${s.date} ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)} (${shiftHours(s)}h) | ${s.title ?? 'Shift'} | ${s.assignedEmployeeNames?.join(', ') || 'unstaffed'} | needs ${Math.max(0, staffTarget(s, rules) - s.assignedEmployeeIds.length)} more`).join('\n') || '(none)'}${shifts.length > 60 ? `\n…and ${shifts.length - 60} more` : ''}

## TOOLS
Use the tools to read and change the schedule. To staff a shift, call find_coverage first and pick an "ok" candidate (fewest hours this week) before considering "warn" ones; never try "block" candidates. When asked to assign shifts, actually do it with assign_shift rather than only suggesting.

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
      const sendText = async (text: string) => {
        const words = text.split(' ');
        for (let i = 0; i < words.length; i += 3) {
          send({ text: words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '') });
          await new Promise(r => setTimeout(r, 8));
        }
      };

      try {
        let claudeMessages: Anthropic.MessageParam[] = messages.map(m => ({ role: m.role, content: m.content }));
        const MAX_ROUNDS = 8;
        let answered = false;

        for (let round = 1; round <= MAX_ROUNDS; round++) {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: systemPrompt,
            tools: TOOLS,
            messages: claudeMessages,
          });

          // Show any text Claude wrote, including text alongside tool calls.
          for (const block of response.content) {
            if (block.type === 'text' && block.text.trim()) { await sendText(block.text + '\n'); answered = true; }
          }

          if (response.stop_reason === 'refusal') {
            if (!answered) await sendText("I can't help with that request.");
            answered = true;
            break;
          }
          const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
          if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
            if (response.stop_reason === 'max_tokens') await sendText('\n_(Response was cut short — ask me to continue.)_');
            break;
          }

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tb of toolUses) {
            send({ tool_action: `Using ${tb.name.replace(/_/g, ' ')}…` });
            const { text, changed } = await executeTool(caller, tb.name, tb.input as Record<string, any>);
            if (changed) send({ changed: true });
            results.push({ type: 'tool_result', tool_use_id: tb.id, content: text });
          }
          claudeMessages = [
            ...claudeMessages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: results },
          ];

          if (round === MAX_ROUNDS) {
            await sendText('\nI reached my step limit for one request. Ask me to continue and I\'ll pick up where I left off.');
            answered = true;
          }
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
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
