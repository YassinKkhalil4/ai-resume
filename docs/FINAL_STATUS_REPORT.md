# Final Status Report

This document is intentionally current-state focused. Older deployment notes that claimed all issues were resolved have been superseded by the launch-hardening work.

## Current Launch Gates

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run db:migrate`

## Required Production Services

- PostgreSQL database
- Redis or Upstash Redis for 60-minute session storage
- OpenAI API key
- Resend email configuration
- Lemon Squeezy checkout links, variant ids, and signed webhooks
- `INTERNAL_AI_PROCESSOR_SECRET` for internal AI processor calls

## Current Billing Model

Lemon Squeezy handles checkout. Signed `order_created` webhooks add 12-month credit lots, and `order_refunded` webhooks revoke unspent credits or mark the event for manual review if credits were already spent.
