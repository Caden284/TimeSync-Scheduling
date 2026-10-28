import { describe, expect, it } from 'vitest';
import {
  autoFill, checkAssignment, weekHours,
  type EngineContext, type EngineEmployee, type EngineRule, type EngineShift, type EngineTaskType,
} from './rule-engine';

const STAFF = 'wt-staff';
const STUDENT = 'wt-student';

const emp = (id: string, workerTypeId: string, extra: Partial<EngineEmployee> = {}): EngineEmployee =>
  ({ id, firstName: id, lastName: '', isActive: true, workerTypeId, ...extra });

let seq = 0;
const shift = (date: string, start: string, end: string, extra: Partial<EngineShift> = {}): EngineShift =>
  ({ id: `s${++seq}`, date, startTime: start, endTime: end, minStaff: 1, assignedEmployeeIds: [], ...extra });

const rule = (ruleType: string, constraintType: 'hard' | 'soft', parameters: Record<string, unknown> = {}, extra: Partial<EngineRule> = {}): EngineRule =>
  ({ name: ruleType, ruleType, constraintType, isEnabled: true, parameters, ...extra });

const tasks: EngineTaskType[] = [
  { id: 'desk', name: '#LN1 Desk' },
  { id: 'fedex', name: 'Outgoing Shipment FedEx', allowedWorkerTypeIds: [STAFF] },
  { id: 'audit', name: 'LibCal Equipment Audit', allowedEmployeeIds: ['dana'] },
  { id: 'brk', name: '15 Minute Break', isBreak: true },
];
const workerTypes = [{ id: STAFF, name: 'Staff' }, { id: STUDENT, name: 'Student' }];

const ctx = (shifts: EngineShift[], rules: EngineRule[] = []): EngineContext =>
  ({ shifts, timeOff: [], overrides: [], rules, taskTypes: tasks, workerTypes });

describe('task eligibility', () => {
  it('blocks a worker type the task is not open to', () => {
    const s = shift('2026-10-26', '09:00', '10:00', { taskTypeId: 'fedex' });
    const c = checkAssignment(s, emp('sam', STUDENT), ctx([s]));
    expect(c.find(x => x.code === 'TASK_ELIGIBILITY')).toMatchObject({ severity: 'block', message: expect.stringContaining('Staff') });
    expect(checkAssignment(s, emp('pat', STAFF), ctx([s])).some(x => x.code === 'TASK_ELIGIBILITY')).toBe(false);
  });

  it('limits a task to named people when listed', () => {
    const s = shift('2026-10-26', '09:00', '10:00', { taskTypeId: 'audit' });
    expect(checkAssignment(s, emp('pat', STAFF), ctx([s])).some(x => x.code === 'TASK_ELIGIBILITY')).toBe(true);
    expect(checkAssignment(s, emp('dana', STUDENT), ctx([s])).some(x => x.code === 'TASK_ELIGIBILITY')).toBe(false);
  });

  it('leaves unrestricted tasks open to everyone', () => {
    const s = shift('2026-10-26', '09:00', '10:00', { taskTypeId: 'desk' });
    expect(checkAssignment(s, emp('sam', STUDENT), ctx([s]))).toEqual([]);
  });
});

describe('back-to-back tasks', () => {
  it('does not treat consecutive same-day tasks as missing rest', () => {
    const a = shift('2026-10-26', '09:00', '10:00', { assignedEmployeeIds: ['pat'] });
    const b = shift('2026-10-26', '10:00', '11:00');
    const c = checkAssignment(b, emp('pat', STAFF), ctx([a, b], [rule('MIN_REST_BETWEEN', 'hard', { hours: 10 })]));
    expect(c).toEqual([]);
  });

  it('still enforces rest between working days', () => {
    const a = shift('2026-10-26', '14:00', '23:00', { assignedEmployeeIds: ['pat'] });
    const b = shift('2026-10-27', '06:00', '10:00');
    const c = checkAssignment(b, emp('pat', STAFF), ctx([a, b], [rule('MIN_REST_BETWEEN', 'hard', { hours: 10 })]));
    expect(c.map(x => x.code)).toContain('MIN_REST');
  });

  it('still blocks overlapping tasks', () => {
    const a = shift('2026-10-26', '09:00', '10:00', { assignedEmployeeIds: ['pat'] });
    const b = shift('2026-10-26', '09:30', '10:30');
    expect(checkAssignment(b, emp('pat', STAFF), ctx([a, b])).map(x => x.code)).toContain('DOUBLE_BOOKED');
  });
});

describe('breaks', () => {
  it("don't count toward hour limits", () => {
    const a = shift('2026-10-26', '09:00', '13:00', { assignedEmployeeIds: ['pat'] });
    const br = shift('2026-10-26', '13:00', '13:15', { taskTypeId: 'brk', assignedEmployeeIds: ['pat'] });
    expect(weekHours(ctx([a, br]), 'pat', '2026-10-26')).toBe(4);
  });

  it('warn when the person is not working next to the break', () => {
    const br = shift('2026-10-26', '13:00', '13:15', { taskTypeId: 'brk' });
    expect(checkAssignment(br, emp('pat', STAFF), ctx([br])).map(x => x.code)).toEqual(['BREAK_NOT_ON_SHIFT']);
  });
});

describe('rule scope by worker type', () => {
  it('applies a student-only cap to students only', () => {
    const cap = rule('MAX_HOURS_WEEK', 'hard', { hours: 3 }, { scopeWorkerTypes: [STUDENT] });
    const s = shift('2026-10-26', '09:00', '13:00');
    expect(checkAssignment(s, emp('sam', STUDENT), ctx([s], [cap])).map(x => x.code)).toContain('MAX_HOURS_WEEK');
    expect(checkAssignment(s, emp('pat', STAFF), ctx([s], [cap]))).toEqual([]);
  });
});

describe('autoFill on a pre-set day', () => {
  it('respects eligibility, keeps people in continuous blocks, and gives breaks to adjacent workers', () => {
    const slots = [
      shift('2026-10-26', '09:00', '10:00', { taskTypeId: 'desk' }),
      shift('2026-10-26', '10:00', '11:00', { taskTypeId: 'desk' }),
      shift('2026-10-26', '11:00', '11:15', { taskTypeId: 'brk' }),
      shift('2026-10-26', '11:15', '12:00', { taskTypeId: 'desk' }),
      shift('2026-10-26', '09:00', '10:00', { taskTypeId: 'fedex' }),
      shift('2026-10-26', '10:00', '11:00', { taskTypeId: 'fedex' }),
    ];
    const people = [emp('pat', STAFF), emp('sam', STUDENT)];
    const res = autoFill(slots, people, ctx(slots));
    const who = (s: EngineShift) => res.changes.find(c => c.shiftId === s.id)?.employeeIds ?? [];

    expect(res.unfilled).toEqual([]);
    // FedEx is staff-only.
    expect(who(slots[4])).toEqual(['pat']);
    expect(who(slots[5])).toEqual(['pat']);
    // The student holds the desk until the break.
    expect(who(slots[0])).toEqual(['sam']);
    expect(who(slots[1])).toEqual(['sam']);
    // The break goes to whoever works straight through it.
    const [onBreak] = who(slots[2]);
    expect(who(slots[3])).toEqual([onBreak]);
    expect([...who(slots[1]), ...who(slots[5])]).toContain(onBreak);
  });

  it('gives a mid-rotation break to whoever just finished a block', () => {
    const slots = [
      shift('2026-10-26', '10:00', '11:00', { taskTypeId: 'desk' }),
      shift('2026-10-26', '11:00', '12:00', { taskTypeId: 'desk' }),
      shift('2026-10-26', '11:00', '11:15', { taskTypeId: 'brk' }),
      shift('2026-10-26', '11:30', '12:30', { taskTypeId: 'desk' }),
    ];
    const res = autoFill(slots, [emp('amy', STUDENT), emp('bo', STUDENT)], ctx(slots));
    const who = (s: EngineShift) => res.changes.find(c => c.shiftId === s.id)?.employeeIds ?? [];
    expect(res.unfilled).toEqual([]);
    expect(who(slots[2])).toEqual(who(slots[0]));          // 10–11 person takes the 11:00 break
    expect(who(slots[3])).toEqual(who(slots[0]));          // …and returns at 11:30
    expect(who(slots[1])).not.toEqual(who(slots[0]));      // someone else covers 11–12
  });

  it('prefers the slot\'s usual person when they are free', () => {
    const s = shift('2026-10-26', '09:00', '10:00', { preferredEmployeeIds: ['zoe'] });
    const res = autoFill([s], [emp('amy', STAFF), emp('zoe', STAFF)], ctx([s]));
    expect(res.changes[0].employeeIds).toEqual(['zoe']);
  });

  it('explains why a restricted slot stays open', () => {
    const s = shift('2026-10-26', '09:00', '10:00', { taskTypeId: 'fedex' });
    const res = autoFill([s], [emp('sam', STUDENT)], ctx([s]));
    expect(res.unfilled[0].reason).toBe('No one else is allowed to do this task.');
  });

  it('leaves a break open when nobody works next to it', () => {
    const br = shift('2026-10-26', '13:00', '13:15', { taskTypeId: 'brk' });
    const res = autoFill([br], [emp('pat', STAFF)], ctx([br]));
    expect(res.unfilled[0].reason).toBe('No one is working right before or after this break.');
  });
});

describe('existing rules', () => {
  it('blocks approved time off and warns on pending', () => {
    const s = shift('2026-10-26', '09:00', '17:00');
    const c: EngineContext = { ...ctx([s]), timeOff: [
      { employeeId: 'pat', startDate: '2026-10-26', endDate: '2026-10-26', status: 'approved' },
      { employeeId: 'sam', startDate: '2026-10-26', endDate: '2026-10-27', status: 'pending' },
    ] };
    expect(checkAssignment(s, emp('pat', STAFF), c).map(x => [x.code, x.severity])).toEqual([['TIME_OFF', 'block']]);
    expect(checkAssignment(s, emp('sam', STAFF), c).map(x => [x.code, x.severity])).toEqual([['TIME_OFF_PENDING', 'warn']]);
  });

  it('caps daily hours across tasks', () => {
    const a = shift('2026-10-26', '08:00', '16:00', { assignedEmployeeIds: ['pat'] });
    const b = shift('2026-10-26', '16:00', '20:00');
    const c = checkAssignment(b, emp('pat', STAFF), ctx([a, b], [rule('MAX_HOURS_DAY', 'hard', { hours: 10 })]));
    expect(c.map(x => x.code)).toEqual(['MAX_HOURS_DAY']);
  });
});
