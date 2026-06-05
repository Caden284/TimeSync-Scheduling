// ============================================================
// TimeSync — Comprehensive Mock Data for Development / Demo
// ============================================================

import type {
  Organization, Department, Location, Role, Employee,
  Shift, ShiftAssignment, Schedule, SchedulingRule,
  EmployeeSummary, AnalyticsMetric, LaborCostBreakdown,
  CoverageHeatmapCell,
} from '@/types';
import { generateColor } from './utils';
import { addDays, format, startOfWeek } from 'date-fns';

// ——— Organization ———————————————————————————————————————————

export const mockOrg: Organization = {
  id: 'org-1',
  name: 'Metro General Hospital',
  slug: 'metro-general',
  vertical: 'healthcare',
  plan: 'enterprise',
  timezone: 'America/New_York',
  locale: 'en-US',
  currency: 'USD',
  logoUrl: undefined,
  primaryColor: '#6366f1',
  settings: {},
  featureFlags: { ai_copilot: true, realtime_collab: true, advanced_analytics: true },
  isActive: true,
  createdAt: '2025-01-15T00:00:00Z',
};

// ——— Locations ———————————————————————————————————————————————

export const mockLocations: Location[] = [
  { id: 'loc-1', orgId: 'org-1', name: 'Main Campus', code: 'MAIN', city: 'New York', state: 'NY', timezone: 'America/New_York', isActive: true },
  { id: 'loc-2', orgId: 'org-1', name: 'North Campus', code: 'NORTH', city: 'New York', state: 'NY', timezone: 'America/New_York', isActive: true },
  { id: 'loc-3', orgId: 'org-1', name: 'Outpatient Center', code: 'OPC', city: 'Brooklyn', state: 'NY', timezone: 'America/New_York', isActive: true },
];

// ——— Departments ——————————————————————————————————————————————

export const mockDepartments: Department[] = [
  { id: 'dept-1', orgId: 'org-1', locationId: 'loc-1', name: 'Intensive Care Unit', code: 'ICU', color: '#ef4444', isActive: true, budgetWeekly: 45000, budgetMonthly: 180000 },
  { id: 'dept-2', orgId: 'org-1', locationId: 'loc-1', name: 'Emergency Department', code: 'ED', color: '#f97316', isActive: true, budgetWeekly: 60000, budgetMonthly: 240000 },
  { id: 'dept-3', orgId: 'org-1', locationId: 'loc-1', name: 'General Surgery', code: 'GS', color: '#8b5cf6', isActive: true, budgetWeekly: 35000, budgetMonthly: 140000 },
  { id: 'dept-4', orgId: 'org-1', locationId: 'loc-2', name: 'Pediatrics', code: 'PED', color: '#06b6d4', isActive: true, budgetWeekly: 28000, budgetMonthly: 112000 },
  { id: 'dept-5', orgId: 'org-1', locationId: 'loc-1', name: 'Radiology', code: 'RAD', color: '#22c55e', isActive: true, budgetWeekly: 22000, budgetMonthly: 88000 },
];

// ——— Roles ————————————————————————————————————————————————————

export const mockRoles: Role[] = [
  { id: 'role-1', orgId: 'org-1', departmentId: 'dept-1', name: 'Charge Nurse', code: 'CN', level: 3, payRateMin: 48, payRateMax: 65, payRateType: 'hourly', color: '#ef4444', isActive: true },
  { id: 'role-2', orgId: 'org-1', departmentId: 'dept-1', name: 'Staff Nurse (RN)', code: 'RN', level: 2, payRateMin: 38, payRateMax: 52, payRateType: 'hourly', color: '#f97316', isActive: true },
  { id: 'role-3', orgId: 'org-1', departmentId: 'dept-1', name: 'Patient Care Tech', code: 'PCT', level: 1, payRateMin: 22, payRateMax: 28, payRateType: 'hourly', color: '#eab308', isActive: true },
  { id: 'role-4', orgId: 'org-1', departmentId: 'dept-2', name: 'Emergency Physician', code: 'EP', level: 4, payRateMin: 120, payRateMax: 180, payRateType: 'hourly', color: '#6366f1', isActive: true },
  { id: 'role-5', orgId: 'org-1', departmentId: 'dept-2', name: 'ED Nurse (RN)', code: 'EDN', level: 2, payRateMin: 40, payRateMax: 55, payRateType: 'hourly', color: '#8b5cf6', isActive: true },
];

// ——— Employees ————————————————————————————————————————————————

const makeEmployee = (
  id: string, first: string, last: string,
  deptId: string, roleId: string, type: Employee['employmentType'],
  payRate: number, color: string,
  tags: string[] = []
): Employee => ({
  id, orgId: 'org-1',
  firstName: first, lastName: last,
  email: `${first.toLowerCase()}.${last.toLowerCase()}@metrogeneral.org`,
  phone: `(212) 555-${String(Math.floor(1000 + Math.random() * 9000))}`,
  avatarUrl: undefined,
  displayColor: color,
  employmentType: type,
  status: 'active',
  primaryDeptId: deptId,
  primaryRoleId: roleId,
  primaryLocationId: 'loc-1',
  hireDate: '2022-03-15',
  weeklyHoursTarget: type === 'full_time' ? 36 : type === 'part_time' ? 24 : 12,
  weeklyHoursMin: 0,
  weeklyHoursMax: 40,
  payRate,
  payRateType: 'hourly',
  overtimeEligible: true,
  seniorityDate: '2022-03-15',
  unionMember: true,
  skills: [],
  certifications: [],
  availability: [
    { id: `${id}-av-1`, dayOfWeek: 1, available: true, allDay: true, preference: 'preferred' },
    { id: `${id}-av-2`, dayOfWeek: 2, available: true, allDay: true, preference: 'preferred' },
    { id: `${id}-av-3`, dayOfWeek: 3, available: true, allDay: true, preference: 'available' },
    { id: `${id}-av-4`, dayOfWeek: 4, available: true, allDay: true, preference: 'available' },
    { id: `${id}-av-5`, dayOfWeek: 5, available: true, allDay: true, preference: 'available' },
    { id: `${id}-av-6`, dayOfWeek: 6, available: true, allDay: false, startTime: '08:00:00', endTime: '18:00:00', preference: 'available' },
    { id: `${id}-av-0`, dayOfWeek: 0, available: false, allDay: true, preference: 'unavailable' },
  ],
  tags,
  customFields: {},
  createdAt: '2022-03-15T00:00:00Z',
});

export const mockEmployees: Employee[] = [
  makeEmployee('emp-1',  'Sarah',    'Chen',      'dept-1', 'role-1', 'full_time', 52.00, '#ef4444', ['charge', 'preceptor']),
  makeEmployee('emp-2',  'Marcus',   'Williams',  'dept-1', 'role-2', 'full_time', 44.50, '#f97316', ['icu', 'vented']),
  makeEmployee('emp-3',  'Priya',    'Patel',     'dept-1', 'role-2', 'full_time', 42.00, '#8b5cf6', ['icu']),
  makeEmployee('emp-4',  'Jordan',   'Smith',     'dept-1', 'role-2', 'part_time', 41.00, '#06b6d4', ['icu', 'nights']),
  makeEmployee('emp-5',  'Alex',     'Johnson',   'dept-1', 'role-3', 'full_time', 24.50, '#22c55e', ['pct']),
  makeEmployee('emp-6',  'Taylor',   'Brown',     'dept-2', 'role-4', 'full_time', 145.00, '#6366f1', ['trauma', 'peds']),
  makeEmployee('emp-7',  'Morgan',   'Davis',     'dept-2', 'role-5', 'full_time', 46.00, '#a855f7', ['triage', 'charge']),
  makeEmployee('emp-8',  'Riley',    'Martinez',  'dept-2', 'role-5', 'full_time', 43.00, '#ec4899', ['triage']),
  makeEmployee('emp-9',  'Casey',    'Wilson',    'dept-1', 'role-2', 'per_diem',  48.00, '#f59e0b', ['icu', 'float']),
  makeEmployee('emp-10', 'Jamie',    'Anderson',  'dept-1', 'role-2', 'part_time', 41.50, '#14b8a6', ['icu']),
  makeEmployee('emp-11', 'Drew',     'Taylor',    'dept-3', 'role-2', 'full_time', 40.00, '#3b82f6', ['surgery', 'scrub']),
  makeEmployee('emp-12', 'Cameron',  'Lee',       'dept-3', 'role-2', 'full_time', 39.50, '#d946ef', ['surgery']),
];

// ——— Generate shifts for current week ——————————————————————

function getWeekStart(): Date {
  return startOfWeek(new Date(), { weekStartsOn: 0 });
}

const shiftTemplates = [
  { start: '07:00:00', end: '19:00:00', label: 'Day', color: '#6366f1' },
  { start: '19:00:00', end: '07:00:00', label: 'Night', color: '#1e1b4b', crosses: true },
  { start: '11:00:00', end: '23:00:00', label: 'Evening', color: '#7c3aed' },
];

export const mockShifts: Shift[] = [];
let shiftSeq = 1;

for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
  const date = format(addDays(getWeekStart(), dayOffset), 'yyyy-MM-dd');
  const isWeekend = dayOffset === 0 || dayOffset === 6;

  // ICU shifts
  ['dept-1'].forEach((deptId) => {
    shiftTemplates.forEach((tpl, tplIdx) => {
      const shiftId = `shift-${shiftSeq++}`;
      const assignedEmps = !isWeekend || tplIdx === 0
        ? [mockEmployees[tplIdx === 0 ? 0 : tplIdx === 1 ? 3 : 1]]
        : [mockEmployees[8]];

      mockShifts.push({
        id: shiftId,
        orgId: 'org-1',
        scheduleId: 'sched-1',
        departmentId: deptId,
        roleId: tplIdx === 0 ? 'role-1' : 'role-2',
        locationId: 'loc-1',
        date,
        startTime: tpl.start,
        endTime: tpl.end,
        startDatetime: `${date}T${tpl.start}`,
        endDatetime: `${date}T${tpl.end}`,
        crossesMidnight: tpl.crosses ?? false,
        durationHours: 12,
        breakMinutes: 30,
        shiftType: 'fixed',
        status: 'scheduled',
        isOpen: false,
        minStaff: 1,
        maxStaff: 2,
        requiredSkills: [],
        requiredCerts: [],
        title: `ICU ${tpl.label} Shift`,
        color: tpl.color,
        department: mockDepartments[0],
        role: mockRoles[tplIdx === 0 ? 0 : 1],
        location: mockLocations[0],
        assignments: assignedEmps.map((emp) => ({
          id: `assign-${shiftSeq}-${emp.id}`,
          shiftId,
          employeeId: emp.id,
          employee: emp as EmployeeSummary,
          status: 'assigned' as const,
          assignedBy: 'ai' as const,
          aiScore: 0.87,
          aiExplanation: {
            reasons: [
              { factor: 'Certification Match', detail: 'Valid BLS & ACLS', weight: 'HARD' as const },
              { factor: 'Availability', detail: 'Marked as preferred', weight: 0.9, score: 1.0 },
              { factor: 'Fairness', detail: 'On par with team average', weight: 0.7, score: 0.85 },
            ],
            alternativesConsidered: ['Casey Wilson (per-diem)', 'Jamie Anderson (part-time)'],
            overallScore: 0.87,
          },
          payRate: emp.payRate,
        })),
        metadata: {},
        createdAt: new Date().toISOString(),
      });
    });
  });

  // Open shift
  if (!isWeekend) {
    const openId = `shift-open-${dayOffset}`;
    mockShifts.push({
      id: openId,
      orgId: 'org-1',
      scheduleId: 'sched-1',
      departmentId: 'dept-2',
      roleId: 'role-5',
      locationId: 'loc-1',
      date,
      startTime: '07:00:00',
      endTime: '15:00:00',
      startDatetime: `${date}T07:00:00`,
      endDatetime: `${date}T15:00:00`,
      crossesMidnight: false,
      durationHours: 8,
      breakMinutes: 30,
      shiftType: 'open',
      status: 'open',
      isOpen: true,
      minStaff: 1,
      maxStaff: 1,
      requiredSkills: [],
      requiredCerts: [],
      title: 'ED Open Shift',
      color: '#f59e0b',
      department: mockDepartments[1],
      role: mockRoles[4],
      location: mockLocations[0],
      assignments: [],
      metadata: {},
      createdAt: new Date().toISOString(),
    });
  }
}

// ——— Schedule ————————————————————————————————————————————————

export const mockSchedule: Schedule = {
  id: 'sched-1',
  orgId: 'org-1',
  name: 'Week of June 1, 2026',
  startDate: format(getWeekStart(), 'yyyy-MM-dd'),
  endDate: format(addDays(getWeekStart(), 6), 'yyyy-MM-dd'),
  status: 'published',
  generatedBy: 'ai',
  version: 2,
  shifts: mockShifts,
  createdAt: new Date().toISOString(),
};

// ——— Rules ————————————————————————————————————————————————————

export const mockRules: SchedulingRule[] = [
  {
    id: 'rule-1', orgId: 'org-1',
    name: 'ICU Minimum Staffing — Day',
    description: 'ICU requires at least 2 nurses on day shift',
    ruleType: 'MIN_STAFFING', constraintType: 'hard',
    priority: 10, scopeDepts: ['dept-1'],
    conditions: [], parameters: { min_count: 2, role_id: 'role-2' },
    isEnabled: true, isSystem: false, createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'rule-2', orgId: 'org-1',
    name: 'Weekly Hour Cap (FLSA)',
    description: 'No employee may exceed 40 hours per week without overtime approval',
    ruleType: 'MAX_HOURS_WEEK', constraintType: 'hard',
    priority: 5,
    conditions: [], parameters: { hours: 40 },
    isEnabled: true, isSystem: true, createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'rule-3', orgId: 'org-1',
    name: 'Minimum Rest Between Shifts',
    description: 'Employees must have at least 10 hours rest between shifts',
    ruleType: 'MIN_REST_BETWEEN', constraintType: 'hard',
    priority: 8,
    conditions: [], parameters: { hours: 10 },
    isEnabled: true, isSystem: true, createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'rule-4', orgId: 'org-1',
    name: 'ICU Charge Nurse Certification Required',
    description: 'Charge nurse role requires valid CCRN certification',
    ruleType: 'CERT_REQUIRED', constraintType: 'hard',
    priority: 15, scopeRoles: ['role-1'],
    conditions: [], parameters: { cert_id: 'cert-ccrn' },
    isEnabled: true, isSystem: false, createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'rule-5', orgId: 'org-1',
    name: 'Honor Employee Availability',
    description: 'Prefer scheduling within stated availability windows',
    ruleType: 'PREFER_AVAILABILITY', constraintType: 'soft',
    priority: 100, weight: 0.9,
    conditions: [], parameters: {},
    isEnabled: true, isSystem: true, createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'rule-6', orgId: 'org-1',
    name: 'Balance Weekend Shifts',
    description: 'Distribute weekend assignments fairly across all employees',
    ruleType: 'BALANCE_WEEKENDS', constraintType: 'soft',
    priority: 110, weight: 0.75,
    conditions: [], parameters: {},
    isEnabled: true, isSystem: false, createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'rule-7', orgId: 'org-1',
    name: 'Minimize Overtime',
    description: 'Prefer assignments that do not cause overtime',
    ruleType: 'MINIMIZE_OVERTIME', constraintType: 'soft',
    priority: 105, weight: 0.8,
    conditions: [], parameters: {},
    isEnabled: true, isSystem: true, createdAt: '2025-01-15T00:00:00Z',
  },
];

// ——— Analytics ————————————————————————————————————————————————

export const mockAnalyticsMetrics: AnalyticsMetric[] = [
  { label: 'Total Labor Cost', value: 184230, previousValue: 176800, unit: 'currency', trend: 'up', trendPct: 4.2 },
  { label: 'Overtime Hours', value: 87, previousValue: 112, unit: 'hours', trend: 'down', trendPct: -22.3 },
  { label: 'Coverage Rate', value: 94.2, previousValue: 91.8, unit: 'percentage', trend: 'up', trendPct: 2.6 },
  { label: 'Unfilled Shifts', value: 6, previousValue: 14, unit: 'count', trend: 'down', trendPct: -57.1 },
  { label: 'Avg Hours / Employee', value: 36.4, previousValue: 35.8, unit: 'hours', trend: 'up', trendPct: 1.7 },
  { label: 'Schedule Satisfaction', value: 87, previousValue: 83, unit: 'percentage', trend: 'up', trendPct: 4.8 },
];

export const mockLaborBreakdown: LaborCostBreakdown[] = [
  { departmentId: 'dept-1', departmentName: 'ICU',               regularHours: 540, overtimeHours: 24, regularCost: 27000, overtimeCost: 2160, totalCost: 29160, budget: 45000, budgetVariance: 15840 },
  { departmentId: 'dept-2', departmentName: 'Emergency Dept',    regularHours: 820, overtimeHours: 36, regularCost: 41000, overtimeCost: 3240, totalCost: 44240, budget: 60000, budgetVariance: 15760 },
  { departmentId: 'dept-3', departmentName: 'General Surgery',   regularHours: 480, overtimeHours: 18, regularCost: 22000, overtimeCost: 1350, totalCost: 23350, budget: 35000, budgetVariance: 11650 },
  { departmentId: 'dept-4', departmentName: 'Pediatrics',        regularHours: 380, overtimeHours: 9,  regularCost: 17000, overtimeCost: 675,  totalCost: 17675, budget: 28000, budgetVariance: 10325 },
  { departmentId: 'dept-5', departmentName: 'Radiology',         regularHours: 290, overtimeHours: 0,  regularCost: 12000, overtimeCost: 0,    totalCost: 12000, budget: 22000, budgetVariance: 10000 },
];

export const mockWeeklyTrend = [
  { week: 'May 5',  cost: 168000, overtime: 145, coverage: 88 },
  { week: 'May 12', cost: 172000, overtime: 132, coverage: 90 },
  { week: 'May 19', cost: 169000, overtime: 118, coverage: 91 },
  { week: 'May 26', cost: 176800, overtime: 112, coverage: 92 },
  { week: 'Jun 2',  cost: 184230, overtime: 87,  coverage: 94 },
];

export const mockCoverageHeatmap: CoverageHeatmapCell[] = [];
for (let d = 0; d < 7; d++) {
  const date = format(addDays(getWeekStart(), d), 'yyyy-MM-dd');
  for (let h = 0; h < 24; h++) {
    const required = (h >= 7 && h < 19) ? 4 : 2;
    const scheduled = Math.max(0, required - (Math.random() > 0.85 ? 1 : 0));
    mockCoverageHeatmap.push({
      date,
      hour: h,
      required,
      scheduled,
      coveragePct: scheduled / required * 100,
    });
  }
}
