#!/bin/bash

# Stripe Setup Helper Script
# This script helps you set up Stripe for local development

echo "🔧 Stripe Setup Helper"
echo "======================"
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Install it with:"
    echo "   brew install stripe/stripe-cli/stripe"
    exit 1
fi

echo "✅ Stripe CLI found"
echo ""

# Check if user is logged in
if ! stripe config --list &> /dev/null; then
    echo "⚠️  Not logged in to Stripe CLI"
    echo "   Run: stripe login"
    exit 1
fi

echo "✅ Logged in to Stripe CLI"
echo ""

# Check for .env.local
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found. Creating template..."
    cat > .env.local << EOF
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
EOF
    echo "✅ Created .env.local template"
    echo "   Please add your Stripe keys to .env.local"
    echo ""
fi

echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Get your Stripe API keys from:"
echo "   https://dashboard.stripe.com/test/apikeys"
echo ""
echo "2. Add them to .env.local:"
echo "   STRIPE_SECRET_KEY=sk_test_..."
echo ""
echo "3. Create products in Stripe Dashboard:"
echo "   https://dashboard.stripe.com/test/products"
echo ""
echo "4. Update lib/stripe/config.ts with your Price IDs"
echo ""
echo "5. Start webhook forwarding:"
echo "   stripe listen --forward-to localhost:3000/api/billing/webhook"
echo ""
echo "6. Copy the webhook secret to .env.local:"
echo "   STRIPE_WEBHOOK_SECRET=whsec_..."
echo ""



