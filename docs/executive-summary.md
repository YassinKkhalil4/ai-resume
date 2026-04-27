# Executive Summary

tailora v2 gives hiring teams and career services an integrity-first resume tailoring workflow that reduces manual editing time while preserving candidate truthfulness.

- **Value Proposition:** Tailors resumes to job descriptions in seconds, surfaces ATS keyword coverage, and highlights risky embellishments before export.
- **Differentiators:** Combines ATS scoring, honesty scan guardrails, and export-ready templates in a single flow. Redis session TTLs, file discard after parsing, and invite/rate gating support controlled rollouts.
- **Operating Model:** Runs on Next.js with PostgreSQL, Redis, OpenAI, Lemon Squeezy, optional external PDF rendering, and Docker/Vercel deployment paths.
- **Economics:** Costs are primarily OpenAI tokens, optional PDF rendering, and hosting. Actual unit economics should be recalculated from live token/export usage.
- **Readiness:** Launch requires configured database migrations, Redis, email verification, Lemon Squeezy webhooks, OpenAI, and the test/build checks documented in the README.
