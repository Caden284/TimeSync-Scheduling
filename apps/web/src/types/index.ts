// ============================================================
// TimeSync Scheduling — Core Type Definitions
// ============================================================

export type UUID = string;
export type ISODate = string;     // "2026-06-05"
export type ISOTime = string;     // "09:00:00"
export type ISODateTime = string; // "2026-06-05T09:00:00Z"

// ============================================================
// ORGANIZATION
// ============================================================

export type OrganizationVertical =
  | 'healthcare' | 'library' | 'university' | 'restaurant' | 'retail'
  | 'warehouse' | 'government' | 'security' | 'events' | 'manufacturing'
  | 'nonprofit' | 'call_center' | 'hotel' | 'airline' | 'construction' | 'other';

export type PlanTier = 'starter' | 'professional' | 'business' | 'enterprise';

export interface Organization {
  id: UUID;
  name: string;
  slug: string;
  vertical: OrganizationVertical;
  plan: PlanTier;
  timezone: string;
  locale: string;
  currency: string;
  logoUrl?: string;
  primaryColor: string;
  settings: Record<string, unknown>;
  featureFlags: Record<string, boolean>;
  isActive: boolean;
  createdAt: ISODateTime;
}

// ============================================================
// LOCATION & DEPARTMENT
// ============================================================

export interface Location {
  id: UUID;
  orgId: UUID;
  name: string;
  code?: string;
  city?: string;
  state?: string;
  timezone?: string;
  isActive: boolean;
}

export interface Department {
  id: UUID;
  orgId: UUID;
  locationId?: UUID;
  parentDeptId?: UUID;
  name: string;
  code?: string;
  color?: string;
  budgetWeekly?: number;
  budgetMonthly?: number;
  managerId?: UUID;
  isActive: boolean;
  location?: Location;
  manager?: Employee;
}

// ============================================================
// EMPLOYEE
// ============================================================

export type EmploymentType =
  | 'full_time' | 'part_time' | 'per_diem' | 'contract'
  | 'seasonal' | 'intern' | 'volunteer';

export type EmployeeStatus = 'active' | 'inactive' | 'on_leave' | 'terminated';

export interface Skill {
  id: UUID;
  name: string;
  code?: string;
  category?: string;
}

export interface CertificationDefinition {
  id: UUID;
  name: string;
  code?: string;
  validityMonths?: number;
  renewalNoticeDays: number;
  isRequiredByLaw: boolean;
}

export interface EmployeeSkill {
  skillId: UUID;
  skill: Skill;
  proficiency: 1 | 2 | 3 | 4 | 5;
  verified: boolean;
}

export interface EmployeeCertification {
  id: UUID;
  certDefId: UUID;
  certDef: CertificationDefinition;
  certNumber?: string;
  issuedDate?: ISODate;
  expiryDate?: ISODate;
  status: 'active' | 'expired' | 'pending_renewal' | 'suspended';
  verified: boolean;
}

export interface AvailabilityWindow {
  id: UUID;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun
  available: boolean;
  allDay: boolean;
  startTime?: ISOTime;
  endTime?: ISOTime;
  preference: 'available' | 'preferred' | 'unavailable';
}

export interface Employee {
  id: UUID;
  orgId: UUID;
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  displayColor?: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  primaryDeptId?: UUID;
  primaryRoleId?: UUID;
  primaryLocationId?: UUID;
  primaryDept?: Department;
  primaryRole?: Role;
  primaryLocation?: Location;
  hireDate?: ISODate;
  weeklyHoursTarget?: number;
  weeklyHoursMin?: number;
  weeklyHoursMax?: number;
  payRate?: number;
  payRateType: 'hourly' | 'salary' | 'tipped' | 'contract';
  overtimeEligible: boolean;
  seniorityDate?: ISODate;
  unionMember: boolean;
  skills: EmployeeSkill[];
  certifications: EmployeeCertification[];
  availability: AvailabilityWindow[];
  tags: string[];
  customFields: Record<string, unknown>;
  createdAt: ISODateTime;
}

export type EmployeeSummary = Pick<
  Employee,
  'id' | 'firstName' | 'lastName' | 'preferredName' | 'email' |
  'avatarUrl' | 'displayColor' | 'employmentType' | 'status' |
  'primaryDeptId' | 'primaryRoleId'
> & { primaryDept?: Pick<Department, 'id' | 'name' | 'color'> };

// ============================================================
// ROLES / POSITIONS
// ============================================================

export interface Role {
  id: UUID;
  orgId: UUID;
  departmentId?: UUID;
  name: string;
  code?: string;
  level: number;
  payRateMin?: number;
  payRateMax?: number;
  payRateType: string;
  color?: string;
  isActive: boolean;
  department?: Department;
}

// ============================================================
// SHIFTS
// ============================================================

export type ShiftType = 'fixed' | 'dynamic' | 'open' | 'split' | 'overnight' | 'oncall' | 'recurring';
export type ShiftStatus = 'scheduled' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface Shift {
  id: UUID;
  orgId: UUID;
  scheduleId?: UUID;
  templateId?: UUID;
  departmentId?: UUID;
  roleId?: UUID;
  locationId?: UUID;
  date: ISODate;
  startTime: ISOTime;
  endTime: ISOTime;
  startDatetime: ISODateTime;
  endDatetime: ISODateTime;
  crossesMidnight: boolean;
  durationHours: number;
  breakMinutes: number;
  shiftType: ShiftType;
  status: ShiftStatus;
  isOpen: boolean;
  minStaff: number;
  maxStaff?: number;
  requiredSkills: UUID[];
  requiredCerts: UUID[];
  payRateOverride?: number;
  title?: string;
  notes?: string;
  color?: string;
  department?: Department;
  role?: Role;
  location?: Location;
  assignments: ShiftAssignment[];
  metadata: Record<string, unknown>;
  createdAt: ISODateTime;
}

export interface ShiftAssignment {
  id: UUID;
  shiftId: UUID;
  employeeId: UUID;
  employee?: EmployeeSummary;
  roleId?: UUID;
  status: 'assigned' | 'confirmed' | 'declined' | 'no_show' | 'completed';
  assignedBy: 'manual' | 'ai' | 'self_pickup';
  aiScore?: number;
  aiExplanation?: AIExplanation;
  confirmedAt?: ISODateTime;
  payRate?: number;
  notes?: string;
}

export interface AIExplanation {
  reasons: AIReason[];
  alternativesConsidered: string[];
  overallScore: number;
}

export interface AIReason {
  factor: string;
  detail: string;
  weight: 'HARD' | number;
  score?: number;
}

// ============================================================
// SCHEDULE
// ============================================================

export type ScheduleStatus = 'draft' | 'generating' | 'review' | 'published' | 'archived';

export interface Schedule {
  id: UUID;
  orgId: UUID;
  name: string;
  description?: string;
  startDate: ISODate;
  endDate: ISODate;
  status: ScheduleStatus;
  departmentIds?: UUID[];
  locationIds?: UUID[];
  generatedBy: 'manual' | 'ai' | 'import';
  publishedAt?: ISODateTime;
  version: number;
  shifts?: Shift[];
  createdAt: ISODateTime;
}

// ============================================================
// RULE ENGINE
// ============================================================

export type ConstraintType = 'hard' | 'soft';

export type RuleType =
  // Hard
  | 'MIN_STAFFING' | 'MAX_STAFFING' | 'REQUIRE_SKILL' | 'REQUIRE_CERT'
  | 'MAX_HOURS_DAY' | 'MAX_HOURS_WEEK' | 'MIN_REST_BETWEEN'
  | 'MAX_CONSECUTIVE_DAYS' | 'BREAK_REQUIREMENT' | 'NO_OVERTIME_UNAUTH'
  | 'CERT_REQUIRED' | 'MINOR_RESTRICTIONS'
  // Soft
  | 'PREFER_AVAILABILITY' | 'PREFER_DAYS' | 'BALANCE_HOURS'
  | 'BALANCE_WEEKENDS' | 'MINIMIZE_OVERTIME' | 'MINIMIZE_COST'
  | 'SENIORITY_ORDER' | 'SKILL_MATCH_QUALITY';

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'contains';
  value: unknown;
}

export interface SchedulingRule {
  id: UUID;
  orgId: UUID;
  name: string;
  description?: string;
  ruleType: RuleType;
  constraintType: ConstraintType;
  priority: number;
  weight?: number;
  scopeDepts?: UUID[];
  scopeLocations?: UUID[];
  scopeRoles?: UUID[];
  scopeEmpTypes?: EmploymentType[];
  scopeEmpTags?: string[];
  scopeShiftTypes?: ShiftType[];
  conditions: RuleCondition[];
  parameters: Record<string, unknown>;
  effectiveDate?: ISODate;
  expiryDate?: ISODate;
  daysOfWeek?: number[];
  isEnabled: boolean;
  isSystem: boolean;
  createdAt: ISODateTime;
}

// ============================================================
// AI GENERATION
// ============================================================

export interface GenerationJob {
  id: UUID;
  orgId: UUID;
  scheduleId?: UUID;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  inputParams: GenerationParams;
  resultSummary?: GenerationSummary;
  solutions?: GenerationSolution[];
  selectedSolution?: number;
  errorMessage?: string;
  durationMs?: number;
  employeesCount?: number;
  shiftsCount?: number;
  assignmentsCount?: number;
  hardViolations: RuleViolation[];
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface GenerationParams {
  startDate: ISODate;
  endDate: ISODate;
  departmentIds?: UUID[];
  locationIds?: UUID[];
  optimizationGoals: OptimizationGoal[];
  maxRuntime?: number;
}

export type OptimizationGoal =
  | 'minimize_cost' | 'maximize_coverage' | 'maximize_fairness'
  | 'minimize_overtime' | 'maximize_preference';

export interface GenerationSolution {
  index: number;
  label: string;
  scores: {
    coverage: number;
    cost: number;
    fairness: number;
    preference: number;
    overall: number;
  };
  stats: {
    totalCost: number;
    overtimeHours: number;
    unfilledShifts: number;
    avgPreferenceScore: number;
  };
  assignments: ShiftAssignment[];
}

export interface GenerationSummary {
  totalShifts: number;
  assignedShifts: number;
  unfilledShifts: number;
  totalHours: number;
  estimatedCost: number;
  overtimeHours: number;
  constraintViolations: number;
}

export interface RuleViolation {
  ruleId: UUID;
  ruleName: string;
  severity: 'error' | 'warning';
  message: string;
  affectedEntities: { type: string; id: UUID; name: string }[];
}

// ============================================================
// ANALYTICS
// ============================================================

export interface AnalyticsMetric {
  label: string;
  value: number;
  previousValue?: number;
  unit: 'currency' | 'hours' | 'count' | 'percentage';
  trend: 'up' | 'down' | 'flat';
  trendPct?: number;
}

export interface CoverageHeatmapCell {
  date: ISODate;
  hour: number;
  required: number;
  scheduled: number;
  coveragePct: number;
}

export interface LaborCostBreakdown {
  departmentId: UUID;
  departmentName: string;
  regularHours: number;
  overtimeHours: number;
  regularCost: number;
  overtimeCost: number;
  totalCost: number;
  budget: number;
  budgetVariance: number;
}

// ============================================================
// COPILOT
// ============================================================

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: ISODateTime;
  actions?: CopilotAction[];
  isStreaming?: boolean;
}

export interface CopilotAction {
  type: 'assign_shift' | 'generate_schedule' | 'show_employee' | 'show_analytics' | 'edit_rule';
  label: string;
  payload: Record<string, unknown>;
  executed?: boolean;
}

export interface CopilotConversation {
  id: UUID;
  title: string;
  messages: CopilotMessage[];
  scheduleId?: UUID;
  createdAt: ISODateTime;
}

// ============================================================
// CALENDAR
// ============================================================

export type CalendarView = 'day' | 'week' | 'month' | 'timeline' | 'department' | 'role' | 'location';

export interface CalendarState {
  view: CalendarView;
  currentDate: ISODate;
  selectedShiftIds: UUID[];
  highlightedEmployeeId?: UUID;
  showWeekends: boolean;
  showCoverageOverlay: boolean;
  groupBy?: 'department' | 'role' | 'location' | 'employee';
  filters: CalendarFilters;
}

export interface CalendarFilters {
  departmentIds?: UUID[];
  locationIds?: UUID[];
  roleIds?: UUID[];
  employmentTypes?: EmploymentType[];
  shiftTypes?: ShiftType[];
  showOpen?: boolean;
  showFilled?: boolean;
}

// ============================================================
// UI STATE
// ============================================================

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  requestId: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
}
