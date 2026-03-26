# Subscription Plan (Future Reference)

**Status**: Not started — blocked on LLC formation
**Last updated**: 2026-03-25

## Overview

Stripe-based subscription system to replace the beta allowlist as the primary access gate. The beta allowlist is retained as a free-access override for invited testers.

## Pricing

- ~$29/month
- 7-day free trial with card required upfront

## Architecture

### Database

`subscriptions` table with Stripe fields:
- `user_id` (PK, FK to auth.users)
- `stripe_customer_id`
- `stripe_subscription_id`
- `status` (active, trialing, past_due, canceled, etc.)
- `current_period_start`, `current_period_end`
- `trial_end`
- `created_at`, `updated_at`

### Payment Flow

1. **Stripe Checkout** — hosted payment page for new subscriptions
2. **Customer Portal** — Stripe-hosted portal for subscription management (cancel, update payment method)
3. **`verify-checkout` edge function** — called after Checkout redirect to avoid post-checkout race condition (webhook may not have fired yet)

### Webhook Sync

- Stripe webhook edge function receives subscription lifecycle events
- Updates `subscriptions` table to keep status in sync
- Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

### Access Integration

- Guards and middleware already handle access checks — extend to include `status IN ('active', 'trialing')`
- Beta allowlist kept as free-access override (checked first, skips subscription check)
- `NoAccessPage` becomes `SubscribePage` with pricing display and Checkout button

### Edge Functions

- `create-checkout` — creates Stripe Checkout session
- `verify-checkout` — verifies session completion, upserts subscription row
- `create-portal` — creates Stripe Customer Portal session
- Stripe webhook handler (receives events, updates subscription status)

## Prerequisites (Before Accepting Payments)

1. **LLC formation** — Washington State (sos.wa.gov, ~$200 filing fee)
2. **Terms of Service** — generate via template service (Termly or iubenda)
3. **Privacy Policy** — generate via template service (Termly or iubenda)
4. **Stripe account** — connect to LLC bank account

## Migration Path

1. Form LLC, set up Stripe account
2. Generate ToS and Privacy Policy, add to app
3. Implement `subscriptions` table + webhook
4. Implement Checkout + Portal edge functions
5. Convert `NoAccessPage` to `SubscribePage`
6. Extend `withMiddleware` and `useAccess` to check subscription status
7. Beta allowlist users continue with free access
