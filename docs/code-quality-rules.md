# Code Quality Rules (Source of Truth)

This document defines the quality standards enforced across the Odie AI codebase.

## The Golden Rules

### 1. No Duplicate Code

**Definition**: Same logic appearing in multiple places

**Why it matters**: Inconsistencies in behavior always trace back to duplicate code. When similar features behave differently, there's likely duplicated implementations.

**Detection**:
- `pnpm dup:check` (jscpd with <3% threshold)

**Fix**:
- Extract to shared helper/component
- Use shared hooks for common patterns
- Consolidate CSS into App.css or shared modules

### 2. No Name Inflation

**Bad Pattern**:
```
getUsers → getUsersIncludingAdmins → getUsersIncludingAdminsAndGuests
```

**Good Pattern**:
```
getUsers (handles all cases via parameters)
// OR
getAdmins (clearly intentional, different purpose)
```

**Detection**:
- PR review for V2/V3/IncludingX/WithY patterns
- validation-agent check

**Fix**:
- Modify the original function to handle the new case
- Use parameters/options instead of new function names

### 3. No Patch-on-Patch

**Bad Pattern**:
```typescript
// Adapter that fixes another function's broken output
function fixBrokenUserData(data) {
  return {
    ...data,
    name: data.name.trim(), // fixing upstream bug here
  }
}
```

**Good Pattern**:
```typescript
// Fix the original function instead
function getUserData() {
  return {
    name: name.trim(), // fixed at source
  }
}
```

**Detection**:
- Look for functions that just wrap and modify other functions
- validation-agent check

**Fix**:
- Fix the root cause in the original function
- Remove the adapter/wrapper

### 4. Surgical Fixes

**Principle**: Every change should improve the codebase, not add complexity

**Questions to ask**:
- Does this fix simplify or add complexity?
- Am I adding code, or could I remove code instead?
- Is this the minimal change needed?

**Anti-patterns**:
- Adding feature flags for simple fixes
- Adding backwards-compatibility shims
- Adding helper functions for one-time use

### 5. Inconsistency = Duplication

**Rule**: If similar features behave differently, there's duplicate code.

**Example**:
- If BulletsPage filter works differently than ResumesPage filter
- They shouldn't have separate implementations
- Extract to shared component

**Fix**:
- Find the duplicate implementations
- Consolidate into shared component/hook
- Ensure consistent behavior

## Automated Quality Checks

Run these commands to verify code quality:

```bash
# Code style
pnpm lint

# Type safety
pnpm typecheck

# Unit/integration tests with coverage (>90%)
pnpm test:coverage

# Code duplication (<3%)
pnpm dup:check

# E2E tests
pnpm test:e2e

# No skipped tests
pnpm no-skip

# All quality gates at once
pnpm quality
```

## Thresholds

| Metric | Threshold | Command |
|--------|-----------|---------|
| Test Coverage | >90% | `pnpm test:coverage` |
| Code Duplication | <3% | `pnpm dup:check` |
| Skipped Tests | 0 | `pnpm no-skip` |
| Lint Errors | 0 | `pnpm lint` |
| Type Errors | 0 | `pnpm typecheck` |
| E2E Failures | 0 | `pnpm test:e2e` |

## Debug Workflow Integration

All bug fixes should go through the `debug-agent` workflow:

1. **UNDERSTAND**: Read specs, identify root cause
2. **PLAN**: Design surgical fix, check quality gates
3. **EXECUTE**: Delegate to specialized agents
4. **VALIDATE**: Run all automated checks

See `.claude/agents/debug-agent.md` for full workflow.
