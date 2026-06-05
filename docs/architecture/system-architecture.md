# TimeSync Scheduling — System Architecture

## Overview

TimeSync is a cloud-native, multi-tenant SaaS platform built on a microservices architecture. All services communicate via REST/GraphQL APIs and an internal event bus. The platform is deployable on AWS, GCP, or Azure via Kubernetes.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT TIER                               │
│                                                                     │
│   ┌─────────────────┐    ┌─────────────────┐   ┌───────────────┐  │
│   │  Next.js Web    │    │  iOS / Android  │   │  Partner API  │  │
│   │  (TypeScript)   │    │  (React Native) │   │  (REST/OAuth) │  │
│   └────────┬────────┘    └────────┬────────┘   └───────┬───────┘  │
└────────────┼────────────────────┼───────────────────────┼──────────┘
             │                    │                       │
             └────────────────────┼───────────────────────┘
                                  │ HTTPS / WSS
┌─────────────────────────────────┼─────────────────────────────────┐
│                        API GATEWAY / CDN                           │
│              (AWS CloudFront + API Gateway / Nginx)                │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
┌─────────────────────────────────┼──────────────────────────────────┐
│                      APPLICATION TIER                               │
│                                                                     │
│   ┌───────────────────┐   ┌──────────────────┐   ┌─────────────┐  │
│   │  Node.js API      │   │  Python Scheduler │   │  WebSocket  │  │
│   │  (Fastify/TS)     │   │  (FastAPI/OR-Tools│   │  Server     │  │
│   │  Port 4000        │   │  Port 8000        │   │  Port 4001  │  │
│   └────────┬──────────┘   └────────┬─────────┘   └──────┬──────┘  │
│            │                       │                      │         │
└────────────┼───────────────────────┼──────────────────────┼────────┘
             │                       │                      │
┌────────────┼───────────────────────┼──────────────────────┼────────┐
│                        DATA / MESSAGE TIER                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────┐ │
│  │ PostgreSQL   │  │   Redis      │  │  BullMQ  │  │ S3/GCS    │ │
│  │ (Primary DB) │  │ (Cache/Pub-  │  │  (Job    │  │ (Files &  │ │
│  │ TimescaleDB  │  │  Sub/Session)│  │  Queue)  │  │  Exports) │ │
│  └──────────────┘  └──────────────┘  └──────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Service Descriptions

### 1. Next.js Web Application (`apps/web`)
- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **State:** Zustand (client state) + TanStack Query (server state)
- **Styling:** Tailwind CSS + custom design tokens
- **Real-time:** Socket.io client for live collaboration
- **Auth:** NextAuth.js with JWT + refresh tokens

### 2. Node.js API Server (`apps/api`)
- **Framework:** Fastify (high-performance, schema-based)
- **Language:** TypeScript
- **ORM:** Prisma (PostgreSQL)
- **Auth:** JWT + API key authentication
- **Cache:** Redis (response cache + session store)
- **Queue:** BullMQ (background jobs)
- **Events:** Redis Pub/Sub for real-time broadcast

### 3. Python Scheduler (`apps/scheduler`)
- **Framework:** FastAPI (async HTTP)
- **Solver:** Google OR-Tools CP-SAT
- **Parallelism:** Multiple solver workers (configurable)
- **Communication:** REST + async job queue (BullMQ via Redis)
- **Startup:** Loaded on-demand by API server for each org

### 4. WebSocket Server
- **Purpose:** Real-time collaborative editing, live presence, notifications
- **Protocol:** Socket.io (rooms per organization/schedule)
- **Events:** cursor_move, shift_drag, assignment_change, user_joined, notification

---

## Data Flow: AI Schedule Generation

```
Manager clicks "AI Generate"
         │
         ▼
Next.js → POST /api/v1/schedules/:id/generate
         │
         ▼
Node.js API:
  1. Validate permissions
  2. Load org rules, employees, existing shifts from PostgreSQL
  3. Create GenerationJob record (status: queued)
  4. Enqueue job to BullMQ
  5. Return job_id to client (HTTP 202)
         │
         ▼
Client polls GET /api/v1/schedules/jobs/:jobId  ← or WebSocket push
         │
         ▼
BullMQ worker picks up job:
  1. POST http://scheduler:8000/generate {employees, shifts, rules}
  2. Scheduler Phase 1: Feasibility check
  3. Scheduler Phase 2: CP-SAT solve (OR-Tools)
  4. Scheduler Phase 3: Score solutions
  5. Scheduler Phase 4: Generate explanations
  6. Return solutions to API worker
         │
         ▼
API worker:
  1. Update GenerationJob (status: completed, solutions: [...])
  2. Optionally apply selected solution to shifts table
  3. Publish WebSocket event: schedule.generation_completed
         │
         ▼
Client receives event → displays solutions for review
```

---

## Multi-Tenancy Architecture

TimeSync uses a **shared database, schema-per-tenant** approach with PostgreSQL Row Level Security:

1. Every table has an `org_id` column
2. RLS policies enforce `org_id = current_setting('app.current_org_id')`
3. The API middleware sets `SET LOCAL app.current_org_id = '{orgId}'` on every request
4. No cross-tenant data leakage is possible at the database layer
5. Tenant isolation is enforced by both application code AND database policies (defense in depth)

---

## Authentication & Authorization

### Authentication Flow
```
1. User submits email/password
2. API validates credentials, checks MFA if enabled
3. API issues access_token (JWT, 24h) + refresh_token (opaque, 30d)
4. Client stores access_token in memory, refresh_token in httpOnly cookie
5. Every API request includes Authorization: Bearer <access_token>
6. On 401, client uses refresh_token to get new access_token
```

### RBAC Model
```
User → UserRole[] → Role → permissions: { resource: action[] }

Resource examples: schedules, employees, rules, reports, settings
Action examples:   read, create, update, delete, publish, approve

Scope dimensions:
  - Organization-wide (default)
  - Department-scoped (role applies only to specific dept)
  - Location-scoped (role applies only to specific location)
```

### Permission Check (pseudocode)
```typescript
function can(user, action, resource, context?) {
  for (const role of user.roles) {
    if (role.permissions['*']?.includes('*')) return true;
    if (role.permissions[resource]?.includes(action)) {
      if (!role.scopeDeptId || role.scopeDeptId === context?.deptId) return true;
    }
  }
  return false;
}
```

---

## Real-time Collaboration

```
Schedule opened by Manager A → joins Socket.io room `schedule:{id}`
Schedule opened by Manager B → joins same room

Manager A drags shift:
  1. Optimistic UI update in Manager A's browser
  2. Emit `shift:drag` event to room
  3. Manager B sees Manager A's cursor and shift position in real-time

Manager A drops shift:
  1. POST /api/v1/shifts/:id/assign {employeeId, date}
  2. API validates (rule engine quick check)
  3. On success: broadcast `shift:assigned` to room
  4. Both managers see committed state
  5. Server undo stack updated

Conflict resolution:
  - Last write wins for shift assignments
  - Conflict toast shown if two managers edit same shift simultaneously
  - Full undo/redo stack per session (50 operations)
```

---

## Deployment Architecture (AWS)

```
Route 53 (DNS)
    │
CloudFront (CDN + WAF)
    ├── Static assets (Next.js build) → S3
    └── API requests → ALB
              │
         ECS Fargate
         ├── web (Next.js)      × 2 tasks min, auto-scale
         ├── api (Node.js)      × 3 tasks min, auto-scale
         ├── scheduler (Python) × 2 tasks min, auto-scale
         └── ws (WebSocket)     × 2 tasks min, auto-scale
              │
         ┌────┴────────────┐
    RDS PostgreSQL      ElastiCache Redis
    (Multi-AZ, 100GB)   (cluster mode)
         │
    S3 (backups, exports, documents)
    CloudWatch (logs, metrics, alerts)
    Secrets Manager (API keys, DB creds)
```

### Kubernetes (Alternative)
```yaml
# Helm chart structure
timesync/
  Chart.yaml
  values.yaml
  templates/
    web-deployment.yaml     # Next.js
    api-deployment.yaml     # Fastify
    scheduler-deployment.yaml  # FastAPI
    ws-deployment.yaml      # WebSocket
    postgres-statefulset.yaml
    redis-statefulset.yaml
    ingress.yaml            # nginx-ingress
    hpa.yaml                # Horizontal Pod Autoscaler
    pdb.yaml                # Pod Disruption Budget
```

---

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| API p95 latency | < 200ms | Redis cache, DB indexes, connection pooling |
| Calendar render | < 200ms | React virtualization, memoization |
| Schedule generation | < 30s (500 emp × 7 days) | CP-SAT parallelism, feasibility pruning |
| WebSocket latency | < 100ms | Direct Redis Pub/Sub, minimal serialization |
| DB query p95 | < 50ms | Targeted indexes, query plans, read replicas |
| Availability | 99.9% | Multi-AZ, health checks, graceful degradation |

---

## Security Measures

1. **Transport:** TLS 1.3 everywhere, HSTS enabled
2. **API:** Rate limiting (500 req/min), API key scoping
3. **Auth:** bcrypt (cost 12), JWT RS256, MFA via TOTP
4. **Data:** AES-256 encryption at rest, field-level encryption for PII
5. **Network:** VPC isolation, security groups, no public DB access
6. **Application:** Input validation via Zod, parameterized queries via Prisma
7. **Audit:** Every mutation logged to append-only audit_logs table
8. **Compliance:** SOC 2 Type II controls, HIPAA BAA available

---

## Folder Structure

```
TimeSync-Scheduling/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/            # Next.js app router pages
│   │   │   ├── components/     # React components
│   │   │   │   ├── calendar/   # Calendar views, shift cards
│   │   │   │   ├── copilot/    # AI copilot panel
│   │   │   │   ├── analytics/  # Charts and metrics
│   │   │   │   ├── employees/  # Employee management
│   │   │   │   ├── rules/      # Rule builder
│   │   │   │   ├── layout/     # Sidebar, topbar
│   │   │   │   └── ui/         # Design system atoms
│   │   │   ├── lib/            # Utilities, mock data
│   │   │   ├── store/          # Zustand stores
│   │   │   ├── types/          # TypeScript types
│   │   │   └── services/       # API client
│   │   ├── public/
│   │   ├── tailwind.config.ts
│   │   └── next.config.js
│   │
│   ├── api/                    # Node.js Fastify API
│   │   ├── src/
│   │   │   ├── routes/         # API route handlers
│   │   │   ├── middleware/     # Auth, tenant, error handling
│   │   │   ├── lib/            # DB, Redis, events, scheduler client
│   │   │   ├── services/       # Business logic layer
│   │   │   └── workers/        # BullMQ background workers
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   │
│   └── scheduler/              # Python FastAPI scheduling engine
│       ├── main.py             # FastAPI app + CP-SAT solver
│       ├── scheduler/
│       │   ├── models.py       # Domain models
│       │   ├── feasibility.py  # Constraint feasibility checker
│       │   ├── explainer.py    # AI explanation generator
│       │   ├── fairness.py     # Fairness scoring
│       │   └── cost.py         # Cost calculation
│       └── requirements.txt
│
├── packages/
│   ├── shared/                 # Shared types (npm package)
│   └── config/                 # Shared ESLint/TS configs
│
└── docs/
    ├── PRD.md                  # Product Requirements Document
    ├── architecture/           # System architecture docs
    ├── api/                    # OpenAPI / REST specs
    └── schemas/                # Database schema
```
