# Feature Summary

**tailora delivers ATS-proof, integrity-first resume tailoring with end-to-end guardrails, ready to run in production this week.**

## Core User Flow
- Upload PDF/DOCX/TXT, paste a job description (or URL), and receive rewrites in under 15 seconds.
- Side-by-side diffing keeps every edit transparent; users can tweak tone before exporting.
- Three ATS-safe templates (Classic, Modern, Minimal) export to selectable PDF or DOCX.

## ATS Intelligence
- Baseline keyword coverage computed on upload; tailored output must show measurable ATS gains before it is returned.
- Keyword heatmaps, coverage deltas, and industry-specific prompts ensure natural language, not keyword stuffing.
- QA harness (`npm run qa`) validates ATS scoring across 100 resume/JD fixtures to guard against regressions.

## Honesty & Integrity Safeguards
- Honesty scan cross-references each tailored bullet against the original resume using Jaccard similarity, flagging risky embellishments.
- Optional enhanced semantic scan path is stubbed (`lib/honesty.ts`) for future embedding checks without changing the API.
- Guardrails in `lib/ai-response-parser.ts` reject outputs that add unsupported claims or regress ATS coverage.

## Privacy, Security & Trust
- No persistent storage: sessions live in-memory for 60 minutes; files are discarded immediately after parsing.
- Rate limits (per-IP and per-session) plus invite codes keep abuse out during pilots.
- Telemetry streams to `/tmp` JSONL files with correlation IDs for debugging without retaining applicant data long term.

## Admin & Operational Controls
- `/admin` console lets operators rotate invites, adjust rate limits, and override OpenAI keys on the fly (stored ephemerally).
- Health checks and PDF renderer monitoring expose export latency, failure alerts, and retry fallbacks (external renderer → Puppeteer → basic HTML→PDF).
- Infrastructure ships with Dockerfile, Vercel config, and container-ready Next.js build pipeline for flexible deployment targets.

## Cost to Operate (≈ $0.02 per tailoring run)
- OpenAI tailoring + extraction: ~$0.0027 total at `gpt-4o-mini` rates.
- PDF export via external renderer: ~$0.006 per download; DOCX is local and free.
- Infrastructure amortisation (1 vCPU / 2 GB VM @ $160 for 2.5k runs): ~$0.0128 allocated to tailoring flow.
- Overall: ~$0.021 per resume, with levers to drop below $0.018 by reducing exports or moving to autoscaled cloud.
