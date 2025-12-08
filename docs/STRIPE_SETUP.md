# Stripe Setup Guide for Credits Billing System

## Prerequisites
- Stripe account (sign up at https://stripe.com)
- Stripe CLI installed (✅ already done via Homebrew)

## Step 1: Login to Stripe CLI

```bash
stripe login
```

This will open your browser to authenticate the CLI with your Stripe account.

## Step 2: Get Your Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Publishable key** (starts with `pk_test_...` or `pk_live_...`)
3. Copy your **Secret key** (starts with `sk_test_...` or `sk_live_...`)

⚠️ **Important:** Use test keys (`pk_test_`, `sk_test_`) for development!

## Step 3: Create Credit Products in Stripe Dashboard

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products)
2. Click **"+ Add product"**
3. Create products for each credit package:

### Recommended Credit Packages:

| Product Name | Description | Price | Credits |
|-------------|-------------|-------|---------|
| 10 Credits | Small credit pack | $4.99 | 10 |
| 25 Credits | Medium credit pack | $9.99 | 25 |
| 50 Credits | Large credit pack | $17.99 | 50 |
| 100 Credits | Extra large credit pack | $29.99 | 100 |

**For each product:**
- **Name:** "X Credits" (e.g., "10 Credits")
- **Description:** "Tailora Credits - Resume Tailoring"
- **Pricing:** One-time payment
- **Price:** Set the amount (e.g., $4.99)
- **Currency:** USD (or your preferred currency)

4. After creating each product, **copy the Price ID** (starts with `price_...`)

## Step 4: Update Credit Package Mapping

Edit `lib/stripe/config.ts` and update the `CREDIT_PACKAGES` object:

```typescript
export const CREDIT_PACKAGES: Record<string, number> = {
  'price_xxxxxxxxxxxxx': 10,   // Replace with your 10 credits Price ID
  'price_yyyyyyyyyyyyy': 25,   // Replace with your 25 credits Price ID
  'price_zzzzzzzzzzzzz': 50,   // Replace with your 50 credits Price ID
  'price_aaaaaaaaaaaaa': 100,  // Replace with your 100 credits Price ID
}
```

## Step 5: Set Up Environment Variables

Add to your `.env.local`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx  # Your Stripe Secret Key
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx  # Will be set up in next step
```

## Step 6: Set Up Webhook Forwarding (Local Development)

For local development, use Stripe CLI to forward webhooks to your local server:

```bash
# Start your Next.js dev server first
npm run dev

# In another terminal, forward webhooks
stripe listen --forward-to localhost:3000/api/billing/webhook
```

The CLI will output a webhook signing secret like:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Copy this secret** and add it to `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

## Step 7: Test the Flow

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **In another terminal, start webhook forwarding:**
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```

3. **Test a purchase:**
   - Sign up/login to your app
   - Click "Buy Credits"
   - Select a package
   - Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

4. **Verify:**
   - Check your database: `users.creditsRemaining` should increase
   - Check `credit_transactions` table for the purchase record
   - Check `webhook_logs` table for the webhook event

## Step 8: Production Setup

When deploying to production:

1. **Switch to Live Mode** in Stripe Dashboard
2. **Get Live API Keys** and update environment variables
3. **Create Products in Live Mode** (same as test mode)
4. **Set up Webhook Endpoint:**
   - Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
   - Click **"+ Add endpoint"**
   - **Endpoint URL:** `https://yourdomain.com/api/billing/webhook`
   - **Events to send:** Select `checkout.session.completed`
   - **Copy the Signing secret** and add to production environment variables

## Troubleshooting

### Webhook signature verification failed
- Make sure `STRIPE_WEBHOOK_SECRET` matches the secret from `stripe listen`
- For production, use the webhook signing secret from Stripe Dashboard

### Credits not being added after purchase
- Check `webhook_logs` table for errors
- Verify the Price ID in `CREDIT_PACKAGES` matches the one used in checkout
- Check database connection and transaction logs

### Test cards not working
- Make sure you're using test mode keys (`sk_test_...`)
- Use test cards from [Stripe Testing Docs](https://stripe.com/docs/testing)

## Useful Stripe CLI Commands

```bash
# Listen to webhooks
stripe listen --forward-to localhost:3000/api/billing/webhook

# Trigger a test webhook
stripe trigger checkout.session.completed

# View webhook events
stripe events list

# View logs
stripe logs tail
```



