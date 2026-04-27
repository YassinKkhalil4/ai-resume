# Deployment Status

The app now builds without requiring `OPENAI_API_KEY` at build time; OpenAI is initialized lazily at runtime when an AI route is called.

## Required Environment

Set the variables listed in `.env.example` before deploying:

- Database and NextAuth secrets
- Redis or Upstash Redis
- OpenAI key/model settings
- Resend sender/API key
- Lemon Squeezy checkout links, variant ids, and webhook secret
- `INTERNAL_AI_PROCESSOR_SECRET`

## Deploy Verification

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Then apply migrations with:

```bash
npm run db:migrate
```
