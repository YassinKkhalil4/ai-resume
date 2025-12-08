# Executive Summary

tailora v2 gives hiring teams and career services a production-ready, integrity-first resume tailoring workflow that reduces manual editing time while preserving candidate truthfulness.

- **Value Proposition:** Tailors resumes to job descriptions in seconds, surfaces ATS keyword coverage, and highlights risky embellishments before export. Teams deliver higher interview win rates without sacrificing trust.
- **Differentiators:** Combines ATS scoring, honesty scan guardrails, and export-ready templates in a single flow. Privacy-first design (in-memory sessions, no persistent storage) and invite/rate gating support controlled rollouts.
- **Operating Model:** Runs on Next.js with OpenAI `gpt-4o-mini`, optional external PDF renderer, and Docker/Vercel deployment paths. Admin console enables non-engineers to manage invites, rate limits, and runtime keys.
- **Economics:** ~\$0.02 per full tailoring run, driven by OpenAI tokens (~\$0.0027), PDF export (~\$0.006), and amortised infrastructure (~\$0.0128). Costs flex downward when PDF exports are optional or infrastructure scales elastically.
- **Readiness:** QA harness exercises ATS scoring across fixture data, telemetry captures every AI attempt, and monitoring covers PDF renderer fallbacks. Ship-ready for pilot deployments with clear hooks for persistence, SSO, or enhanced honesty scanning.*** End Patch
