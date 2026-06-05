// ============================================================
// TimeSync — Organization data stored in localStorage
// This is the single source of truth for demo/local mode.
// In production this would come from the API.
// ============================================================

export interface OrgData {
  name: string;
  vertical: string;
  timezone: string;
  primaryColor: string;
  logoInitials: string;
}

export interface DeptData {
  id: string;
  name: string;
  color: string;
}

export interface LocationData {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department: string;
  employmentType: 'full_time' | 'part_time' | 'per_diem';
  payRate: string;
  phone: string;
  color: string;
}

export interface AppSetup {
  org: OrgData;
  departments: DeptData[];
  locations: LocationData[];
  staff: StaffMember[];
  onboardingComplete: boolean;
  createdAt: string;
}

const KEY = 'timesync_setup';

const PALETTE = [
  '#6366f1','#ef4444','#f97316','#22c55e','#06b6d4',
  '#8b5cf6','#ec4899','#f59e0b','#14b8a6','#3b82f6',
  '#a855f7','#d946ef','#84cc16','#e11d48','#0891b2',
];

export function getNextColor(index: number) {
  return PALETTE[index % PALETTE.length];
}

export function loadSetup(): AppSetup | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSetup(setup: AppSetup) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(setup));
}

export function clearSetup() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

export function isOnboardingComplete(): boolean {
  const setup = loadSetup();
  return !!setup?.onboardingComplete;
}

// Convert setup staff into the Employee shape used by components
export function staffToEmployees(setup: AppSetup) {
  return setup.staff.map((s, i) => ({
    id: s.id,
    orgId: 'local',
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    phone: s.phone,
    avatarUrl: undefined,
    displayColor: s.color,
    employmentType: s.employmentType,
    status: 'active' as const,
    primaryDeptId: setup.departments[0]?.id,
    primaryRoleId: undefined,
    primaryLocationId: setup.locations[0]?.id,
    primaryDept: setup.departments.find(d => d.name === s.department)
      ? { id: setup.departments.find(d => d.name === s.department)!.id, name: s.department, color: setup.departments.find(d => d.name === s.department)!.color }
      : undefined,
    hireDate: new Date().toISOString().split('T')[0],
    weeklyHoursTarget: s.employmentType === 'full_time' ? 40 : s.employmentType === 'part_time' ? 24 : 12,
    weeklyHoursMin: 0,
    weeklyHoursMax: 40,
    payRate: parseFloat(s.payRate) || 0,
    payRateType: 'hourly' as const,
    overtimeEligible: true,
    seniorityDate: new Date().toISOString().split('T')[0],
    unionMember: false,
    skills: [],
    certifications: [],
    availability: [],
    tags: [s.role.toLowerCase().replace(/\s+/g, '_')],
    customFields: {},
    createdAt: new Date().toISOString(),
  }));
}
