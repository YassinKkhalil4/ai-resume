# Lemon Squeezy Setup

Rolefit uses Lemon Squeezy external checkout links and signed webhooks to add credits.

## Products

Create four variants in Lemon Squeezy and set the matching env vars:

- Starter: `LEMON_SQUEEZY_VARIANT_STARTER`
- Job Seeker: `LEMON_SQUEEZY_VARIANT_JOB_SEEKER`
- Power Apply: `LEMON_SQUEEZY_VARIANT_POWER_APPLY`
- Career Coach: `LEMON_SQUEEZY_VARIANT_CAREER_COACH`

Set each public checkout link:

- `NEXT_PUBLIC_CHECKOUT_LINK_STARTER`
- `NEXT_PUBLIC_CHECKOUT_LINK_JOB_SEEKER`
- `NEXT_PUBLIC_CHECKOUT_LINK_POWER_APPLY`
- `NEXT_PUBLIC_CHECKOUT_LINK_CAREER_COACH`

## Checkout Metadata

Users must be signed in and email verified before checkout. The app appends:

- `checkout[custom][user_id]`
- `checkout[custom][package_id]`
- `checkout[email]`

The webhook trusts the Lemon variant id for the credit amount, not the custom package id.

## Webhook

Create a Lemon Squeezy webhook pointing to:

```text
https://your-domain.com/api/billing/webhook
```

Subscribe to:

- `order_created`
- `order_refunded`

Set `LEMON_SQUEEZY_WEBHOOK_SECRET` to the signing secret from Lemon Squeezy.
