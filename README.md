# TimeSync Scheduling

> Enterprise AI Workforce Scheduling Platform — built to surpass LibStaffer, WhenIWork, Deputy, Homebase, and UKG.

---

## What is TimeSync?

TimeSync is a complete, production-ready workforce management platform designed for **any organization** — hospitals, libraries, restaurants, warehouses, universities, call centers, hotels, airlines, and more.

It is built around a **dynamic rule engine** where every scheduling constraint, labor law, staffing requirement, employee preference, and organizational policy is configurable without code changes.

---

## Key Features

| Feature | Description |
|---------|-------------|
| 🤖 AI Schedule Generation | CP-SAT optimization engine (OR-Tools) generates complete, constraint-satisfying schedules in < 30 seconds |
| 💬 AI Copilot | Claude-powered conversational assistant — generate schedules, find coverage, analyze costs, explain decisions |
| 📅 World-Class Calendar | Drag-and-drop week/month/timeline views, real-time collaboration, unlimited undo/redo |
| ⚙️ Visual Rule Engine | No-code drag-and-drop rule builder for hard constraints (labor laws) and soft constraints (preferences) |
| 👥 Employee Management | Unlimited attributes, skills, certifications, availability, preferences, seniority |
| 📊 Workforce Analytics | Real-time labor cost, coverage heatmaps, overtime forecasting, budget vs. actual |
| 🔄 Real-time Collaboration | Multiple managers can edit the same schedule simultaneously with live presence |
| 🏢 Multi-tenant SaaS | Complete tenant isolation via Row Level Security — each org's data is fully isolated |
| 🔗 Integrations | ADP, Paychex, QuickBooks, Slack, Teams, Workday, BambooHR |

---

## Architecture

```
apps/
  web/        Next.js 14 + TypeScript + Tailwind CSS + Zustand
  api/        Node.js + Fastify + Prisma + PostgreSQL + Redis
  scheduler/  Python + FastAPI + Google OR-Tools CP-SAT

packages/
  shared/     Shared TypeScript types
  config/     Shared ESLint/TS configs

docs/
  PRD.md                     Product Requirements Document
  architecture/              System architecture, data flows, deployment
  api/openapi-spec.yaml      Complete REST API specification
  schemas/database-schema.sql Full PostgreSQL schema
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 15+
- Redis 7+

### Install & Run

```bash
# Clone
git clone https://github.com/your-org/timesync-scheduling.git
cd timesync-scheduling

# Install frontend dependencies
cd apps/web && npm install

# Start frontend (demo mode with mock data)
npm run dev
# → http://localhost:3000

# Install backend dependencies
cd ../api && npm install
npx prisma generate
npx prisma migrate dev

# Start API server
npm run dev
# → http://localhost:4000

# Install scheduler dependencies
cd ../scheduler
pip install -r requirements.txt

# Start scheduler
uvicorn main:app --port 8000 --reload
```

### Environment Variables

```bash
# apps/api/.env
DATABASE_URL="postgresql://user:pass@localhost:5432/timesync"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key-min-32-chars"
ANTHROPIC_API_KEY="sk-ant-..."
SCHEDULER_URL="http://localhost:8000"
ALLOWED_ORIGINS="http://localhost:3000"

# apps/web/.env.local
NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
NEXT_PUBLIC_WS_URL="ws://localhost:4001"
NEXTAUTH_SECRET="your-nextauth-secret"
```

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.4
- **Styling:** Tailwind CSS 3.4
- **State:** Zustand + Immer
- **Server State:** TanStack Query v5
- **Charts:** Recharts
- **DnD:** @dnd-kit/core
- **Icons:** Lucide React

### Backend
- **Runtime:** Node.js 20
- **Framework:** Fastify 4
- **ORM:** Prisma 5
- **Database:** PostgreSQL 15 + TimescaleDB
- **Cache:** Redis 7
- **Queue:** BullMQ
- **Auth:** JWT + bcrypt

### AI Scheduling Engine
- **Language:** Python 3.11
- **Framework:** FastAPI
- **Solver:** Google OR-Tools CP-SAT
- **AI Copilot:** Anthropic Claude API (claude-sonnet-4-6)

### Infrastructure
- **Cloud:** AWS (ECS Fargate + RDS + ElastiCache)
- **CDN:** CloudFront
- **CI/CD:** GitHub Actions
- **Containers:** Docker + Kubernetes (Helm)
- **Monitoring:** CloudWatch + Datadog

---

## Documentation

| Document | Path |
|----------|------|
| Product Requirements Document | [docs/PRD.md](docs/PRD.md) |
| System Architecture | [docs/architecture/system-architecture.md](docs/architecture/system-architecture.md) |
| Database Schema | [docs/schemas/database-schema.sql](docs/schemas/database-schema.sql) |
| REST API Specification | [docs/api/openapi-spec.yaml](docs/api/openapi-spec.yaml) |

---

## Supported Organization Types

Libraries · Universities · Hospitals · Restaurants · Retail · Warehouses ·
Government Agencies · Security Companies · Event Companies · Manufacturing ·
Nonprofits · Call Centers · Hotels · Airlines · Construction

---

## License

Proprietary — TimeSync Scheduling © 2026
