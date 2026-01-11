# Odie AI Resume

AI-powered resume builder that helps candidates craft tailored resumes through conversational interviews and intelligent bullet matching.

## Quick Start

```bash
pnpm install                          # Install dependencies
pnpm gen-types                        # Generate TypeScript types from Supabase
pnpm dev                              # Start dev server at http://localhost:5173
```

## Project Structure

```
odie-ai/
├── packages/
│   ├── web/                          # React 19 + Vite frontend (@odie/web)
│   │   ├── src/
│   │   │   ├── components/auth/      # Auth components (AuthProvider, LoginForm, etc.)
│   │   │   ├── pages/                # Page components
│   │   │   ├── lib/                  # Utilities (supabaseClient)
│   │   │   ├── test/                 # Test suite
│   │   │   └── App.tsx               # Main app with routing
│   │   ├── vite.config.ts
│   │   └── vitest.config.ts
│   │
│   ├── db/                           # Database client layer (@odie/db)
│   │   └── src/
│   │       ├── client.ts             # Supabase client
│   │       ├── queries/              # Query functions
│   │       └── types.ts              # Generated Supabase types
│   │
│   └── shared/                       # Shared contracts/validators (@odie/shared)
│       └── src/
│           └── contracts/            # Zod schemas + TypeScript types
│
├── supabase/
│   ├── migrations/                   # SQL migrations
│   └── config.toml                   # Supabase config
│
└── docs/                             # Project documentation
    ├── specs/                        # Feature specifications
    ├── adr/                          # Architecture Decision Records
    ├── migration/                    # Migration guides
    └── db_schema.md                  # Database schema documentation
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router, TypeScript |
| Backend | Supabase (PostgreSQL 15, Auth, pgvector) |
| AI/LLM | OpenAI GPT-4 |
| Email | Resend |
| Testing | Vitest, Testing Library, MSW, Playwright |

## Available Commands

```bash
# Development
pnpm dev                              # Start UI dev server
pnpm --filter @odie/web dev           # Explicit UI dev

# Building
pnpm build                            # Build all packages

# Database
pnpm migrate                          # Push migrations to Supabase
pnpm gen-types                        # Generate TS types from schema

# Testing
pnpm test                             # Run all tests
pnpm test:coverage                    # Coverage report
pnpm --filter @odie/web test:ui       # Tests with UI dashboard

# Quality
pnpm lint                             # Lint all packages
pnpm typecheck                        # Type check all packages
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase (Frontend - VITE_ prefix exposes to browser)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173

# Supabase (Backend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email
RESEND_API_KEY=your-resend-key

# AI
OPENAI_API_KEY=your-openai-key
```

## Authentication Flow

1. **Magic Link**: User enters email → Supabase sends OTP via Resend
2. **Session**: User clicks link → auto-exchanged for JWT session
3. **Profile Check**: First login redirects to `/complete-profile`
4. **Protected Routes**: `AuthGuard` component enforces authentication

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm --filter @odie/web test --watch

# Coverage
pnpm test:coverage
```

## Quality Gates (Non-Negotiable)

- 100% tests passing
- >90% coverage
- No `.skip` in tests
- Duplication scan must pass
- Type check must pass
- Lint must pass
