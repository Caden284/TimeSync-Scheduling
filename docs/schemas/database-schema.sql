-- ============================================================
-- TimeSync Scheduling — Complete PostgreSQL Database Schema
-- Version: 1.0.0
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";       -- composite indexes
CREATE EXTENSION IF NOT EXISTS "timescaledb";     -- time-series analytics

-- ============================================================
-- MULTI-TENANT FOUNDATION
-- ============================================================

CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  vertical        VARCHAR(50),                    -- healthcare, retail, library, etc.
  plan            VARCHAR(50) NOT NULL DEFAULT 'starter', -- starter, pro, business, enterprise
  plan_seats      INTEGER NOT NULL DEFAULT 25,
  timezone        VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
  locale          VARCHAR(20) NOT NULL DEFAULT 'en-US',
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  fiscal_year_start SMALLINT NOT NULL DEFAULT 1, -- 1=Jan, 4=Apr, 7=Jul, 10=Oct
  logo_url        TEXT,
  primary_color   CHAR(7) DEFAULT '#6366f1',
  settings        JSONB NOT NULL DEFAULT '{}',    -- arbitrary org-level config
  feature_flags   JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  trial_ends_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_plan ON organizations(plan);

-- ============================================================
-- LOCATIONS & DEPARTMENTS
-- ============================================================

CREATE TABLE locations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(50),
  address_line1   VARCHAR(255),
  address_line2   VARCHAR(255),
  city            VARCHAR(100),
  state           VARCHAR(100),
  postal_code     VARCHAR(20),
  country         CHAR(2) NOT NULL DEFAULT 'US',
  timezone        VARCHAR(100),                   -- overrides org timezone if set
  phone           VARCHAR(50),
  latitude        DECIMAL(9,6),
  longitude       DECIMAL(9,6),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_locations_org ON locations(org_id);
CREATE INDEX idx_locations_active ON locations(org_id, is_active);

CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  parent_dept_id  UUID REFERENCES departments(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(50),
  color           CHAR(7),                        -- display color on calendar
  budget_weekly   DECIMAL(12,2),
  budget_monthly  DECIMAL(12,2),
  manager_id      UUID,                           -- FK set after employees table
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_org ON departments(org_id);
CREATE INDEX idx_departments_location ON departments(location_id);
CREATE INDEX idx_departments_parent ON departments(parent_dept_id);

-- ============================================================
-- ROLES & POSITIONS
-- ============================================================

CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(50),
  level           SMALLINT DEFAULT 1,             -- hierarchy level
  pay_rate_min    DECIMAL(10,4),
  pay_rate_max    DECIMAL(10,4),
  pay_rate_type   VARCHAR(20) DEFAULT 'hourly',   -- hourly, salary, tipped, contract
  color           CHAR(7),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roles_org ON roles(org_id);
CREATE INDEX idx_roles_dept ON roles(department_id);

-- ============================================================
-- SKILLS & CERTIFICATIONS LIBRARY
-- ============================================================

CREATE TABLE skill_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(100),
  category        VARCHAR(100),
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skills_org ON skill_definitions(org_id);

CREATE TABLE certification_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(100),
  category        VARCHAR(100),
  description     TEXT,
  issuing_body    VARCHAR(255),
  validity_months INTEGER,                        -- how long cert is valid; NULL = no expiry
  renewal_notice_days INTEGER DEFAULT 60,         -- warn X days before expiry
  is_required_by_law BOOLEAN DEFAULT false,
  document_required BOOLEAN DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_certs_org ON certification_definitions(org_id);

-- ============================================================
-- EMPLOYEE MANAGEMENT
-- ============================================================

CREATE TABLE employees (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               UUID UNIQUE,              -- FK to auth.users; NULL if no portal access
  employee_number       VARCHAR(100),

  -- Personal
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100) NOT NULL,
  preferred_name        VARCHAR(100),
  date_of_birth         DATE,
  gender                VARCHAR(50),

  -- Contact
  email                 VARCHAR(255) UNIQUE NOT NULL,
  phone                 VARCHAR(50),
  phone_type            VARCHAR(20) DEFAULT 'mobile',
  address_line1         VARCHAR(255),
  address_line2         VARCHAR(255),
  city                  VARCHAR(100),
  state                 VARCHAR(100),
  postal_code           VARCHAR(20),
  country               CHAR(2) DEFAULT 'US',

  -- Emergency Contact
  emergency_name        VARCHAR(255),
  emergency_phone       VARCHAR(50),
  emergency_relation    VARCHAR(100),

  -- Employment
  hire_date             DATE,
  termination_date      DATE,
  employment_type       VARCHAR(50) NOT NULL DEFAULT 'full_time', -- full_time, part_time, per_diem, contract, seasonal, intern, volunteer
  status                VARCHAR(50) NOT NULL DEFAULT 'active',   -- active, inactive, on_leave, terminated
  primary_dept_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
  primary_role_id       UUID REFERENCES roles(id) ON DELETE SET NULL,
  primary_location_id   UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Seniority
  seniority_date        DATE,                     -- may differ from hire_date (union)
  seniority_tier        VARCHAR(50),
  union_member          BOOLEAN DEFAULT false,
  union_id              VARCHAR(100),

  -- Scheduling
  weekly_hours_target   DECIMAL(5,2),
  weekly_hours_min      DECIMAL(5,2),
  weekly_hours_max      DECIMAL(5,2),
  daily_hours_max       DECIMAL(5,2),
  consecutive_days_max  SMALLINT,
  overtime_eligible     BOOLEAN DEFAULT true,

  -- Compensation
  pay_rate              DECIMAL(10,4),
  pay_rate_type         VARCHAR(20) DEFAULT 'hourly',
  pay_rate_effective    DATE,
  cost_center           VARCHAR(100),

  -- Avatar & Display
  avatar_url            TEXT,
  display_color         CHAR(7),

  -- Custom Attributes
  custom_fields         JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  notes                 TEXT,
  tags                  TEXT[] DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_org ON employees(org_id);
CREATE INDEX idx_employees_status ON employees(org_id, status);
CREATE INDEX idx_employees_dept ON employees(primary_dept_id);
CREATE INDEX idx_employees_role ON employees(primary_role_id);
CREATE INDEX idx_employees_location ON employees(primary_location_id);
CREATE INDEX idx_employees_user ON employees(user_id);
CREATE INDEX idx_employees_tags ON employees USING gin(tags);
CREATE INDEX idx_employees_custom ON employees USING gin(custom_fields);
CREATE INDEX idx_employees_name ON employees USING gin(
  to_tsvector('english', first_name || ' ' || last_name)
);

-- Employee can work multiple departments/locations
CREATE TABLE employee_departments (
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_primary      BOOLEAN DEFAULT false,
  effective_date  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (employee_id, department_id)
);

CREATE TABLE employee_locations (
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_primary      BOOLEAN DEFAULT false,
  effective_date  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (employee_id, location_id)
);

CREATE TABLE employee_roles (
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  is_primary      BOOLEAN DEFAULT false,
  pay_rate_override DECIMAL(10,4),
  effective_date  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (employee_id, role_id)
);

-- Skills
CREATE TABLE employee_skills (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_id        UUID NOT NULL REFERENCES skill_definitions(id) ON DELETE CASCADE,
  proficiency     SMALLINT DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
  verified        BOOLEAN DEFAULT false,
  verified_by     UUID REFERENCES employees(id),
  verified_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, skill_id)
);

CREATE INDEX idx_employee_skills_emp ON employee_skills(employee_id);

-- Certifications
CREATE TABLE employee_certifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cert_def_id     UUID NOT NULL REFERENCES certification_definitions(id) ON DELETE CASCADE,
  cert_number     VARCHAR(255),
  issued_date     DATE,
  expiry_date     DATE,
  issuing_body    VARCHAR(255),
  document_url    TEXT,
  status          VARCHAR(50) DEFAULT 'active',   -- active, expired, pending_renewal, suspended
  verified        BOOLEAN DEFAULT false,
  verified_by     UUID REFERENCES employees(id),
  verified_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emp_certs_emp ON employee_certifications(employee_id);
CREATE INDEX idx_emp_certs_expiry ON employee_certifications(expiry_date) WHERE status = 'active';

-- Availability
CREATE TABLE employee_availability (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  template_name   VARCHAR(100),                   -- named templates, e.g. "Summer", "School Year"
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  available       BOOLEAN NOT NULL DEFAULT true,
  all_day         BOOLEAN DEFAULT true,
  start_time      TIME,                           -- if not all_day
  end_time        TIME,                           -- if not all_day
  preference      VARCHAR(20) DEFAULT 'available', -- available, preferred, unavailable
  effective_start DATE,
  effective_end   DATE,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_avail_emp ON employee_availability(employee_id);
CREATE INDEX idx_avail_active ON employee_availability(employee_id, is_active);

-- Availability Overrides (date-specific)
CREATE TABLE availability_overrides (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  available       BOOLEAN NOT NULL,
  start_time      TIME,
  end_time        TIME,
  reason          VARCHAR(255),
  created_by      UUID REFERENCES employees(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_avail_override_emp ON availability_overrides(employee_id, date);

-- ============================================================
-- SHIFT TEMPLATES
-- ============================================================

CREATE TABLE shift_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  role_id         UUID REFERENCES roles(id) ON DELETE SET NULL,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(100),
  shift_type      VARCHAR(50) NOT NULL DEFAULT 'fixed', -- fixed, dynamic, open, split, overnight, oncall
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  crosses_midnight BOOLEAN DEFAULT false,
  break_minutes   INTEGER DEFAULT 0,
  duration_hours  DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN end_time > start_time
      THEN EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
      ELSE EXTRACT(EPOCH FROM (end_time + INTERVAL '24 hours' - start_time)) / 3600
    END
  ) STORED,
  min_staff       SMALLINT DEFAULT 1,
  max_staff       SMALLINT,
  pay_rate_override DECIMAL(10,4),
  color           CHAR(7),
  required_skills  UUID[],                        -- skill_definition IDs
  required_certs   UUID[],                        -- certification_definition IDs
  notes           TEXT,
  is_active       BOOLEAN DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shift_templates_org ON shift_templates(org_id);
CREATE INDEX idx_shift_templates_dept ON shift_templates(department_id);

-- ============================================================
-- SCHEDULES
-- ============================================================

CREATE TABLE schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, generating, review, published, archived
  department_ids  UUID[],                         -- scoped departments; NULL = all
  location_ids    UUID[],                         -- scoped locations; NULL = all
  generated_by    VARCHAR(50) DEFAULT 'manual',   -- manual, ai, import
  generation_params JSONB,                        -- params used for AI generation
  published_at    TIMESTAMPTZ,
  published_by    UUID REFERENCES employees(id),
  version         INTEGER NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES schedules(id),  -- for versioning
  created_by      UUID REFERENCES employees(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedules_org ON schedules(org_id, status);
CREATE INDEX idx_schedules_dates ON schedules(org_id, start_date, end_date);

-- ============================================================
-- SHIFTS
-- ============================================================

CREATE TABLE shifts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  schedule_id     UUID REFERENCES schedules(id) ON DELETE SET NULL,
  template_id     UUID REFERENCES shift_templates(id) ON DELETE SET NULL,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  role_id         UUID REFERENCES roles(id) ON DELETE SET NULL,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,

  -- Timing
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  start_datetime  TIMESTAMPTZ NOT NULL,           -- computed: date + time + timezone
  end_datetime    TIMESTAMPTZ NOT NULL,
  crosses_midnight BOOLEAN DEFAULT false,
  duration_hours  DECIMAL(5,2),
  break_minutes   INTEGER DEFAULT 0,

  -- Type & Status
  shift_type      VARCHAR(50) NOT NULL DEFAULT 'fixed',
  status          VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- scheduled, open, in_progress, completed, cancelled, no_show
  is_open         BOOLEAN DEFAULT false,          -- available for self-pickup

  -- Requirements
  min_staff       SMALLINT DEFAULT 1,
  max_staff       SMALLINT,
  required_skills  UUID[] DEFAULT '{}',
  required_certs   UUID[] DEFAULT '{}',

  -- Pay
  pay_rate_override DECIMAL(10,4),

  -- Display
  title           VARCHAR(255),
  notes           TEXT,
  color           CHAR(7),

  -- Split shift (second segment)
  split_end_time  TIME,
  split_duration  DECIMAL(5,2),

  -- Recurrence
  recurrence_rule TEXT,                           -- iCal RRULE
  recurrence_id   UUID,                           -- parent recurrence series

  metadata        JSONB NOT NULL DEFAULT '{}',
  created_by      UUID REFERENCES employees(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shifts_org ON shifts(org_id);
CREATE INDEX idx_shifts_schedule ON shifts(schedule_id);
CREATE INDEX idx_shifts_date ON shifts(org_id, date);
CREATE INDEX idx_shifts_dept ON shifts(department_id, date);
CREATE INDEX idx_shifts_location ON shifts(location_id, date);
CREATE INDEX idx_shifts_datetime ON shifts(start_datetime, end_datetime);
CREATE INDEX idx_shifts_open ON shifts(org_id, is_open, date) WHERE is_open = true;
CREATE INDEX idx_shifts_status ON shifts(org_id, status);

-- ============================================================
-- SHIFT ASSIGNMENTS
-- ============================================================

CREATE TABLE shift_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id        UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id         UUID REFERENCES roles(id),
  status          VARCHAR(50) NOT NULL DEFAULT 'assigned', -- assigned, confirmed, declined, no_show, completed
  assigned_by     VARCHAR(50) DEFAULT 'manual',    -- manual, ai, self_pickup
  assigned_by_id  UUID REFERENCES employees(id),
  ai_score        DECIMAL(5,4),                   -- AI quality score for this assignment
  ai_explanation  JSONB,                          -- structured AI reasoning
  confirmed_at    TIMESTAMPTZ,
  declined_at     TIMESTAMPTZ,
  decline_reason  TEXT,
  actual_start    TIMESTAMPTZ,                    -- from time clock
  actual_end      TIMESTAMPTZ,
  break_minutes_actual INTEGER,
  pay_rate        DECIMAL(10,4),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shift_id, employee_id)
);

CREATE INDEX idx_assignments_shift ON shift_assignments(shift_id);
CREATE INDEX idx_assignments_employee ON shift_assignments(employee_id);
CREATE INDEX idx_assignments_org_date ON shift_assignments(org_id, created_at);
CREATE INDEX idx_assignments_status ON shift_assignments(status);

-- ============================================================
-- RULE ENGINE
-- ============================================================

CREATE TABLE rule_categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  sort_order      SMALLINT DEFAULT 0
);

INSERT INTO rule_categories (name, description, sort_order) VALUES
  ('Staffing', 'Minimum and maximum staffing requirements', 1),
  ('Labor Law', 'Regulatory compliance rules', 2),
  ('Hours & Overtime', 'Working hour limits and overtime rules', 3),
  ('Skills & Certifications', 'Qualification requirements', 4),
  ('Employee Preferences', 'Soft preference rules', 5),
  ('Fairness', 'Equitable distribution rules', 6),
  ('Cost', 'Budget and cost optimization rules', 7),
  ('Seniority & Union', 'Seniority and collective bargaining rules', 8),
  ('Custom', 'Organization-specific rules', 9);

CREATE TABLE scheduling_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES rule_categories(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  rule_type       VARCHAR(100) NOT NULL,           -- MIN_STAFFING, MAX_HOURS_WEEK, etc.
  constraint_type VARCHAR(20) NOT NULL DEFAULT 'hard', -- hard, soft
  priority        SMALLINT NOT NULL DEFAULT 100,   -- lower = higher priority
  weight          DECIMAL(4,3),                   -- soft constraint weight (0-1)

  -- Scope
  scope_depts     UUID[],                         -- NULL = all departments
  scope_locations UUID[],                         -- NULL = all locations
  scope_roles     UUID[],                         -- NULL = all roles
  scope_emp_types VARCHAR(50)[],                  -- employment types
  scope_emp_tags  TEXT[],                         -- employee tags
  scope_shift_types VARCHAR(50)[],                -- shift types

  -- Rule logic
  conditions      JSONB NOT NULL DEFAULT '[]',    -- array of condition objects
  parameters      JSONB NOT NULL DEFAULT '{}',    -- rule-specific parameters

  -- Temporal
  effective_date  DATE,
  expiry_date     DATE,
  days_of_week    SMALLINT[],                     -- NULL = all days; [0-6]

  is_enabled      BOOLEAN DEFAULT true,
  is_system       BOOLEAN DEFAULT false,          -- system rules cannot be deleted
  version         SMALLINT DEFAULT 1,

  created_by      UUID REFERENCES employees(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rules_org ON scheduling_rules(org_id, is_enabled);
CREATE INDEX idx_rules_type ON scheduling_rules(org_id, rule_type);
CREATE INDEX idx_rules_constraint ON scheduling_rules(org_id, constraint_type);
CREATE INDEX idx_rules_scope_depts ON scheduling_rules USING gin(scope_depts);
CREATE INDEX idx_rules_scope_roles ON scheduling_rules USING gin(scope_roles);

-- Rule audit/test results
CREATE TABLE rule_evaluations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id         UUID NOT NULL REFERENCES scheduling_rules(id) ON DELETE CASCADE,
  schedule_id     UUID REFERENCES schedules(id),
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result          VARCHAR(20) NOT NULL,            -- pass, fail, warning
  violations      JSONB DEFAULT '[]',
  statistics      JSONB DEFAULT '{}'
);

-- ============================================================
-- TIME OFF & LEAVE
-- ============================================================

CREATE TABLE leave_types (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  code            VARCHAR(50),
  color           CHAR(7),
  paid            BOOLEAN DEFAULT true,
  accrual_based   BOOLEAN DEFAULT false,
  requires_approval BOOLEAN DEFAULT true,
  advance_notice_hours INTEGER DEFAULT 0,
  max_consecutive_days INTEGER,
  sort_order      SMALLINT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true
);

CREATE TABLE time_off_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id   UUID REFERENCES leave_types(id),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  start_time      TIME,                           -- partial day
  end_time        TIME,                           -- partial day
  hours_requested DECIMAL(5,2),
  reason          TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, denied, cancelled
  reviewed_by     UUID REFERENCES employees(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeoff_emp ON time_off_requests(employee_id, status);
CREATE INDEX idx_timeoff_dates ON time_off_requests(org_id, start_date, end_date);

-- ============================================================
-- SHIFT SWAPS
-- ============================================================

CREATE TABLE shift_swaps (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id        UUID NOT NULL REFERENCES employees(id),
  responder_id        UUID REFERENCES employees(id),       -- NULL = open swap request
  requester_shift_id  UUID NOT NULL REFERENCES shifts(id),
  responder_shift_id  UUID REFERENCES shifts(id),          -- NULL = give-away
  swap_type           VARCHAR(20) DEFAULT 'trade',         -- trade, giveaway, pickup
  status              VARCHAR(50) DEFAULT 'pending',       -- pending, accepted, denied, cancelled, approved
  requester_reason    TEXT,
  responder_reason    TEXT,
  manager_approval_id UUID REFERENCES employees(id),
  manager_approved_at TIMESTAMPTZ,
  manager_notes       TEXT,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_swaps_org ON shift_swaps(org_id, status);
CREATE INDEX idx_swaps_requester ON shift_swaps(requester_id);
CREATE INDEX idx_swaps_responder ON shift_swaps(responder_id);

-- ============================================================
-- AI COPILOT & GENERATION HISTORY
-- ============================================================

CREATE TABLE ai_generation_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  schedule_id     UUID REFERENCES schedules(id),
  status          VARCHAR(50) DEFAULT 'queued',   -- queued, running, completed, failed, cancelled
  input_params    JSONB NOT NULL DEFAULT '{}',
  result_summary  JSONB,
  solutions       JSONB,                          -- top N solutions with scores
  selected_solution SMALLINT,
  error_message   TEXT,
  duration_ms     INTEGER,
  employees_count INTEGER,
  shifts_count    INTEGER,
  assignments_count INTEGER,
  hard_violations JSONB DEFAULT '[]',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES employees(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gen_jobs_org ON ai_generation_jobs(org_id, status);
CREATE INDEX idx_gen_jobs_schedule ON ai_generation_jobs(schedule_id);

CREATE TABLE copilot_conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  schedule_id     UUID REFERENCES schedules(id),
  title           VARCHAR(255),
  messages        JSONB NOT NULL DEFAULT '[]',    -- [{role, content, timestamp, actions}]
  context_snapshot JSONB,                         -- schedule context at conversation start
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_copilot_org ON copilot_conversations(org_id, user_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notification_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = system template
  event_type      VARCHAR(100) NOT NULL,
  channel         VARCHAR(50) NOT NULL,           -- email, sms, push, slack, teams
  subject_template TEXT,
  body_template   TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT true
);

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type      VARCHAR(100) NOT NULL,
  channel         VARCHAR(50) NOT NULL,
  subject         TEXT,
  body            TEXT NOT NULL,
  data            JSONB DEFAULT '{}',
  status          VARCHAR(50) DEFAULT 'pending',  -- pending, sent, delivered, failed, read
  sent_at         TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient ON notifications(recipient_id, status);
CREATE INDEX idx_notif_org ON notifications(org_id, created_at DESC);

-- ============================================================
-- AUTHENTICATION & RBAC
-- ============================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id     UUID UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT,
  mfa_secret      TEXT,
  mfa_enabled     BOOLEAN DEFAULT false,
  status          VARCHAR(50) DEFAULT 'active',
  last_login_at   TIMESTAMPTZ,
  last_login_ip   INET,
  failed_attempts SMALLINT DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  email_verified  BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE roles_rbac (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = system role
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  is_system       BOOLEAN DEFAULT false,
  permissions     JSONB NOT NULL DEFAULT '{}',    -- {resource: [action]}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System roles
INSERT INTO roles_rbac (name, description, is_system, permissions) VALUES
  ('super_admin', 'Full system access', true, '{"*": ["*"]}'),
  ('admin', 'Organization admin', true, '{"employees": ["*"], "schedules": ["*"], "rules": ["*"], "reports": ["*"]}'),
  ('scheduler', 'Schedule manager', true, '{"schedules": ["*"], "employees": ["read"], "reports": ["read"]}'),
  ('supervisor', 'Department supervisor', true, '{"schedules": ["read","update"], "employees": ["read"], "swaps": ["approve"]}'),
  ('employee', 'Standard employee', true, '{"schedules": ["read_own"], "availability": ["*_own"], "swaps": ["create_own"], "timeoff": ["create_own"]}');

CREATE TABLE user_roles (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles_rbac(id) ON DELETE CASCADE,
  scope_dept_id   UUID REFERENCES departments(id), -- role scoped to department
  scope_location_id UUID REFERENCES locations(id),
  granted_by      UUID REFERENCES users(id),
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  name            VARCHAR(255) NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,
  key_prefix      CHAR(8) NOT NULL,               -- first 8 chars for identification
  scopes          TEXT[] DEFAULT '{}',
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  action          VARCHAR(100) NOT NULL,           -- create, update, delete, publish, approve, etc.
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     UUID,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE audit_logs_2027 PARTITION OF audit_logs
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE INDEX idx_audit_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- ============================================================
-- ANALYTICS (TimescaleDB Hypertable)
-- ============================================================

CREATE TABLE schedule_metrics (
  time            TIMESTAMPTZ NOT NULL,
  org_id          UUID NOT NULL,
  department_id   UUID,
  location_id     UUID,
  date            DATE NOT NULL,
  total_hours_scheduled DECIMAL(10,2),
  total_hours_actual    DECIMAL(10,2),
  total_labor_cost      DECIMAL(12,2),
  overtime_hours        DECIMAL(8,2),
  overtime_cost         DECIMAL(10,2),
  employees_scheduled   SMALLINT,
  coverage_pct          DECIMAL(5,2),
  unfilled_shifts       SMALLINT,
  swap_count            SMALLINT,
  no_show_count         SMALLINT,
  PRIMARY KEY (time, org_id, date)
);

SELECT create_hypertable('schedule_metrics', 'time', if_not_exists => TRUE);
CREATE INDEX idx_metrics_org ON schedule_metrics(org_id, date);
CREATE INDEX idx_metrics_dept ON schedule_metrics(department_id, date);

-- ============================================================
-- INTEGRATIONS
-- ============================================================

CREATE TABLE integrations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        VARCHAR(100) NOT NULL,           -- adp, paychex, slack, teams, etc.
  name            VARCHAR(255) NOT NULL,
  status          VARCHAR(50) DEFAULT 'active',
  config          JSONB NOT NULL DEFAULT '{}',     -- provider-specific config (no secrets)
  credentials     JSONB,                           -- encrypted credentials reference
  last_sync_at    TIMESTAMPTZ,
  last_sync_status VARCHAR(50),
  last_sync_error TEXT,
  sync_enabled    BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 60,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integrations_org ON integrations(org_id, provider);

CREATE TABLE integration_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  direction       VARCHAR(10) NOT NULL,            -- inbound, outbound
  event_type      VARCHAR(100),
  status          VARCHAR(50) NOT NULL,
  records_processed INTEGER,
  records_failed  INTEGER,
  payload_size_bytes INTEGER,
  error_details   JSONB,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ============================================================
-- FOREIGN KEY COMPLETION
-- ============================================================

ALTER TABLE departments ADD CONSTRAINT fk_dept_manager
  FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'organizations','locations','departments','roles','employees',
    'employee_certifications','employee_availability',
    'shift_templates','schedules','shifts','shift_assignments',
    'scheduling_rules','time_off_requests','shift_swaps',
    'copilot_conversations','users','integrations'
  ]
  LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- ROW-LEVEL SECURITY (Multi-tenant isolation)
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_rules ENABLE ROW LEVEL SECURITY;

-- Org isolation policy (applied via app-set current_setting)
CREATE POLICY org_isolation ON employees
  USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON schedules
  USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON shifts
  USING (org_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY org_isolation ON scheduling_rules
  USING (org_id = current_setting('app.current_org_id')::UUID);

-- ============================================================
-- SEED DATA — Rule Type Registry
-- ============================================================

CREATE TABLE rule_type_registry (
  type            VARCHAR(100) PRIMARY KEY,
  category        VARCHAR(50) NOT NULL,           -- hard, soft
  display_name    VARCHAR(255) NOT NULL,
  description     TEXT,
  parameters_schema JSONB NOT NULL DEFAULT '{}',  -- JSON Schema for parameters
  icon            VARCHAR(50),
  sort_order      SMALLINT
);

INSERT INTO rule_type_registry (type, category, display_name, description, parameters_schema, icon, sort_order) VALUES
('MIN_STAFFING',          'hard', 'Minimum Staffing',          'Require a minimum number of employees per shift', '{"min_count":{"type":"integer"},"role_id":{"type":"string"}}', 'users', 1),
('MAX_STAFFING',          'hard', 'Maximum Staffing',          'Limit maximum employees per shift', '{"max_count":{"type":"integer"}}', 'users-minus', 2),
('REQUIRE_SKILL',         'hard', 'Require Skill',             'Shift requires at least one employee with a specific skill', '{"skill_id":{"type":"string"},"count":{"type":"integer"}}', 'star', 3),
('REQUIRE_CERT',          'hard', 'Require Certification',     'Shift requires valid certification', '{"cert_id":{"type":"string"}}', 'award', 4),
('MAX_HOURS_DAY',         'hard', 'Max Hours Per Day',         'Employee cannot work more than N hours per day', '{"hours":{"type":"number"}}', 'clock', 5),
('MAX_HOURS_WEEK',        'hard', 'Max Hours Per Week',        'Weekly hour cap (FLSA compliance)', '{"hours":{"type":"number"}}', 'calendar-week', 6),
('MIN_REST_BETWEEN',      'hard', 'Minimum Rest Between Shifts','Required rest period between consecutive shifts', '{"hours":{"type":"number"}}', 'moon', 7),
('MAX_CONSECUTIVE_DAYS',  'hard', 'Max Consecutive Work Days', 'Employee must have day off after N consecutive days', '{"days":{"type":"integer"}}', 'calendar', 8),
('BREAK_REQUIREMENT',     'hard', 'Mandatory Break',           'Required break after working N hours', '{"after_hours":{"type":"number"},"break_minutes":{"type":"integer"}}', 'coffee', 9),
('NO_OVERTIME_UNAUTH',    'hard', 'Block Unauthorized Overtime','Prevent overtime without manager approval', '{"threshold_hours":{"type":"number"}}', 'alert-triangle', 10),
('CERT_REQUIRED',         'hard', 'Certification Required',   'Block assignment without valid certification', '{"cert_id":{"type":"string"}}', 'shield-check', 11),
('MINOR_RESTRICTIONS',    'hard', 'Minor Labor Law',          'Restrict hours for employees under 18', '{"max_school_day_hours":{"type":"number"},"max_school_week_hours":{"type":"number"}}', 'user-x', 12),
('PREFER_AVAILABILITY',   'soft', 'Honor Availability',        'Schedule within stated availability windows', '{}', 'check-circle', 101),
('PREFER_DAYS',           'soft', 'Preferred Work Days',       'Honor preferred days of week', '{}', 'calendar-check', 102),
('BALANCE_HOURS',         'soft', 'Balance Hours',             'Equalize hours across team members', '{"method":{"type":"string","enum":["equal","proportional"]}}', 'bar-chart-2', 103),
('BALANCE_WEEKENDS',      'soft', 'Balance Weekends',          'Distribute weekend shifts fairly', '{}', 'sun', 104),
('MINIMIZE_OVERTIME',     'soft', 'Minimize Overtime',         'Prefer assignments that avoid overtime', '{}', 'trending-down', 105),
('MINIMIZE_COST',         'soft', 'Minimize Labor Cost',       'Prefer lower-cost employee assignments', '{"strategy":{"type":"string","enum":["lowest_rate","within_budget"]}}', 'dollar-sign', 106),
('SENIORITY_ORDER',       'soft', 'Seniority-Based Assignment','Assign shifts to senior employees first', '{"method":{"type":"string","enum":["strict","weighted"]}}', 'award', 107),
('SKILL_MATCH_QUALITY',   'soft', 'Optimal Skill Match',       'Prefer best skill-matched employee', '{}', 'target', 108);
