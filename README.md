# County Pulse

A data discovery and management platform that automatically identifies, classifies, and tracks public government datasets from county data sources using AI/LLM technology.

## Quick Start

```bash
pnpm install                          # Install dependencies
pnpm gen-types                        # Generate TypeScript types from Supabase
pnpm dev                              # Start dev server at http://localhost:5173
```

## Project Structure

```
CountyPulse/
├── packages/
│   ├── ui/                           # React 19 + Vite frontend
│   │   ├── src/
│   │   │   ├── components/auth/      # Auth components (AuthProvider, LoginForm, etc.)
│   │   │   ├── pages/                # Page components (CompleteProfile)
│   │   │   ├── lib/                  # Utilities (supabaseClient)
│   │   │   ├── test/                 # Test suite
│   │   │   └── App.tsx               # Main app with routing
│   │   ├── vite.config.ts
│   │   └── vitest.config.ts
│   │
│   ├── db/                           # Database client layer
│   │   └── src/
│   │       ├── client.ts             # Supabase client
│   │       ├── queries/              # Query functions (items, sources, users, agentRuns)
│   │       └── types.ts              # Generated Supabase types
│   │
│   ├── pipeline/                     # Data pipeline & AI agents
│   │   └── src/
│   │       ├── scout.ts              # Dataset discovery
│   │       ├── scoutAgent.ts         # LLM classification logic
│   │       ├── fetcher.ts            # Raw data collection
│   │       ├── normalizer.ts         # Data processing
│   │       └── orchestrator.ts       # Pipeline coordination
│   │
│   └── connectors/
│       └── socrata-metadata/         # Socrata (King County) data connector
│
└── supabase/
    ├── migrations/                   # 15 SQL migrations
    ├── functions/                    # Edge Functions
    └── config.toml                   # Local Supabase config
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router, TypeScript |
| Backend | Supabase (PostgreSQL 15, Auth, Realtime, Edge Functions) |
| AI/LLM | OpenAI GPT-3.5-turbo |
| Data Source | Socrata API (King County open data) |
| Email | Resend |
| Testing | Vitest, Testing Library, MSW |

## Available Commands

```bash
# Development
pnpm dev                              # Start UI dev server
pnpm --filter @county-pulse/ui dev    # Explicit UI dev

# Building
pnpm build                            # Build all packages
pnpm -r build                         # Recursive build

# Database
pnpm migrate                          # Push migrations to Supabase
pnpm gen-types                        # Generate TS types from schema

# Testing
pnpm --filter @county-pulse/ui test           # Run tests
pnpm --filter @county-pulse/ui test:ui        # Tests with UI dashboard
pnpm --filter @county-pulse/ui test:coverage  # Coverage report

# Deployment
pnpm deploy                           # Deploy Supabase Edge Functions
pnpm setup-resend                     # Setup Resend email API key
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase (Frontend - VITE_ prefix exposes to browser)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173

# Supabase (Backend/Pipeline)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email
RESEND_API_KEY=your-resend-key

# AI
OPENAI_COUNTY_PULSE_SCOUT=your-openai-key
```

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `sources` | Tracked datasets (code, name, connector, fetch_interval, config) |
| `raw_items` | Immutable raw data from sources |
| `normalized_items` | Processed items with embeddings (VECTOR 1536) for semantic search |
| `user_profiles` | User profiles with completion tracking |
| `watches` | User subscriptions to categories (RLS protected) |
| `categories` | Available topics for subscription |
| `agent_runs` | LLM execution logs (status, duration, errors) |
| `scout_feedback` | User feedback on AI dataset classifications |

### Key Relationships

```
sources (1) ─── (n) raw_items (1) ─── (1) normalized_items
                                              │
                                              └── (n) item_tags ─── (n) categories
                                                                          │
auth.users (1) ─── (1) user_profiles                                      │
     │                                                                    │
     └── (n) watches ────────────────────────────────────────────────────┘
```

## Authentication Flow

1. **Magic Link**: User enters email → Supabase sends OTP via Resend
2. **Session**: User clicks link → auto-exchanged for JWT session
3. **Profile Check**: First login redirects to `/complete-profile`
4. **Protected Routes**: `AuthGuard` component enforces authentication

```tsx
// Usage in components
const { user, loading, signIn, signOut } = useAuth();
```

## Key Features

### 1. Scout (Dataset Discovery)
- Connects to Socrata (King County open data portal)
- Uses GPT-3.5-turbo to classify datasets by relevance
- Filters for: courts, budget, permits, inspections, public meetings
- Stores discovery reasoning and accepts user feedback

### 2. Data Pipeline
```
Scout → Fetcher → Normalizer
  ↓         ↓          ↓
Discover  Collect   Process &
datasets  raw data  add embeddings
```

### 3. Agent Tracking
All LLM operations logged with:
- Execution status (running/success/failed)
- Duration and token usage
- Error messages for debugging

## Query Functions

### Sources (`@county-pulse/db`)
```ts
import { getSources, getSourceByCode, createSource } from '@county-pulse/db';

const sources = await getSources();
const source = await getSourceByCode('socrata_dataset_123');
```

### Items
```ts
import { getRawItems, getNormalizedItems, searchNormalizedItems } from '@county-pulse/db';

const items = await getNormalizedItems('permits');
const results = await searchNormalizedItems('budget allocation');
```

### Users
```ts
import { getUserProfile, createUserProfile, isProfileComplete } from '@county-pulse/db';

const profile = await getUserProfile(userId);
const complete = isProfileComplete(profile);
```

### Agent Runs
```ts
import { startAgentRun, succeedAgentRun, failAgentRun } from '@county-pulse/db';

const runId = await startAgentRun('scout', { limit: 100 });
await succeedAgentRun(runId, { tokens: 1500 });
```

## UI Components

### Auth Components (`packages/ui/src/components/auth/`)
- `AuthProvider` - Context provider for auth state
- `AuthGuard` - Route protection HOC
- `LoginForm` - Email input with OTP flow
- `LogoutButton` - Sign out with user email display

### Pages (`packages/ui/src/pages/`)
- `CompleteProfile` - Profile completion form (display_name required)

## Testing

```bash
# Run all tests
pnpm --filter @county-pulse/ui test

# Watch mode
pnpm --filter @county-pulse/ui test --watch

# Coverage
pnpm --filter @county-pulse/ui test:coverage
```

Test files located in `packages/ui/src/test/`:
- Component tests
- Integration tests
- Database query tests
- MSW mocks for API

## Path Aliases

Configured in `tsconfig.base.json`:

```ts
import { something } from '@ui/components/auth';     // packages/ui/src/
import { getSources } from '@county-pulse/db';       // packages/db/
import { scout } from '@pipeline/scout';             // packages/pipeline/src/
```

## Project Status

- **Version**: 0.1.0 (Alpha)
- **Database**: 15 migrations
- **Implemented**: Auth, profiles, Scout pipeline, agent tracking
- **WIP**: Dashboard UI, data visualization, daily reports

## Local Supabase Development

```bash
supabase start           # Start local Supabase
supabase stop            # Stop local Supabase
supabase db reset        # Reset database with migrations
supabase gen types typescript --local > packages/db/src/types.ts
```

Local services:
- API: http://localhost:54321
- Studio: http://localhost:54323
- Inbucket (email): http://localhost:54324
