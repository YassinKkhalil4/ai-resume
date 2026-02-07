# Resend Email Setup Guide

This guide explains how to set up email sending for the email verification system.

## Problem

The logs show that `RESEND_API_KEY` is not set, which prevents verification emails from being sent:

```
RESEND_API_KEY environment variable is not set
```

## Solution

You need to:

1. **Sign up for Resend** (if you haven't already):
   - Go to https://resend.com
   - Create an account
   - Verify your email

2. **Create an API Key**:
   - Go to https://resend.com/api-keys
   - Click "Create API Key"
   - Give it a name (e.g., "tailora-production")
   - Copy the API key (you'll only see it once!)

3. **Add the API Key to your environment**:
   
   Create or update your `.env.local` file in the project root:
   
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   VERIFICATION_BASE_URL=http://localhost:3000
   ```
   
   **Important Notes:**
   - `RESEND_API_KEY`: Your API key from Resend
   - `RESEND_FROM_EMAIL`: The email address you want to send from. This must be:
     - A domain you own and have verified in Resend, OR
     - For testing: Use Resend's test domain (check Resend dashboard)
   - `VERIFICATION_BASE_URL`: The base URL for verification links (defaults to `NEXTAUTH_URL`)

4. **Verify your domain in Resend** (for production):
   - Go to https://resend.com/domains
   - Add your domain
   - Follow the DNS verification steps
   - Once verified, you can use emails like `noreply@yourdomain.com`

5. **Restart your development server**:
   ```bash
   npm run dev
   ```

## Testing

After setting up:

1. Sign up with a new account
2. Check your email inbox (and spam folder)
3. You should receive a verification email with:
   - A 6-digit code
   - A verification link

## Troubleshooting

### Emails still not sending?

1. **Check your environment variables**:
   ```bash
   # In your terminal, verify the variables are loaded:
   echo $RESEND_API_KEY
   ```

2. **Check the logs**:
   - Look for `hasResendKey: true` in the debug logs
   - If `hasResendKey: false`, the environment variable isn't being loaded

3. **Verify the API key**:
   - Make sure there are no extra spaces or quotes
   - The key should start with `re_`

4. **Check Resend dashboard**:
   - Go to https://resend.com/emails
   - Check if emails are being sent but failing
   - Look for error messages

5. **Domain verification**:
   - If using a custom domain, ensure it's verified in Resend
   - For testing, you can use Resend's test domain

## Environment Variables Summary

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | Yes | - | Your Resend API key |
| `RESEND_FROM_EMAIL` | No | `noreply@tailora.ai` | Email address to send from |
| `VERIFICATION_BASE_URL` | No | `NEXTAUTH_URL` or `http://localhost:3000` | Base URL for verification links |

## Next Steps

Once emails are working:
- Users will receive verification emails on signup
- Users can verify via code or link
- Unverified users can still use the app but may have limited access (depending on your guards)

