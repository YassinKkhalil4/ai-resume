# tailora — v2 (Complete)

Upload resume (PDF/DOCX/TXT) → paste JD text/URL → tailor bullets with guardrails → preview diffs + ATS → honesty scan → export ATS-safe PDF/DOCX.
Privacy-conscious, invite/rate guarded, Redis-backed sessions, Lemon Squeezy credits, admin console, telemetry, QA harness, and marketing kit.

## Quickstart

```bash
pnpm i || npm i || yarn
cp .env.example .env.local
# set DATABASE_URL, NEXTAUTH_SECRET, OPENAI_API_KEY, Redis, Resend, and Lemon Squeezy values
npm run db:migrate
npm run dev
# open http://localhost:3000
```

### Deploy
- **Vercel**: set `USE_LAMBDA_CHROMIUM=1` and function memory 1024 MB for serverless PDF.
- **Render/VM/Docker**: `puppeteer` works without the serverless build.
- **Docker**:
  ```bash
  docker build -t tailora .
  docker run -p 3000:3000 \
    -e DATABASE_URL=postgresql://... \
    -e NEXTAUTH_SECRET=... \
    -e OPENAI_API_KEY=sk-... \
    -e INTERNAL_AI_PROCESSOR_SECRET=... \
    -e LEMON_SQUEEZY_WEBHOOK_SECRET=... \
    tailora
  ```

## Privacy & Integrity
- **Uploaded files are parsed in memory** and discarded after text extraction.
- **Session state is stored in Redis for 60 minutes** and contains resume/JD text plus generated output.
- **Resume and JD content is sent to OpenAI** for tailoring. Optional PDF services may receive rendered export HTML.
- **Credits are fulfilled by Lemon Squeezy webhooks** and expire 12 months after grant or purchase.
- **No fabricated credentials**: enforced by prompts + integrity check + honesty scan.
- See `/privacy` page for user-facing copy.

## Access Control & Abuse
- **Invite-only**: `INVITE_CODES` env; API checks `x-invite-code` header or `invite` cookie.
- **Rate limits**: per-IP and per-session sliding window (defaults: 30/min IP, 5/min session).
- **Admin console** (`/admin`): inspect users, runs, analytics, and configuration.

> Security: Gate `/admin` behind VPN/SAML in production or store config in a real DB/KV.

## Telemetry
- Correlation ids, latency, token usage, and funnel events are logged to the configured database and optional drains.

## API
- `POST /api/tailor` — FormData `{ resume_file, jd_text|jd_url, tone? }` → `{ session_id, preview_sections_json, original_sections_json, diffs, keyword_stats }`
- `POST /api/export` — JSON `{ session_snapshot, template, format: "pdf"|"docx", options }` → streamed PDF/DOCX
- `GET /api/export/[file]` — download the file created above.
- `POST /api/honesty` — `{ session_id }` → `{ flags: [...] }`
- `POST /api/billing/webhook` — Lemon Squeezy webhook endpoint.

## QA Harness
- `qa/` includes 10×10 fixtures and a baseline coverage script: `npm run qa` → `qa/results/` + `qa/summary.md`

## Marketing
- `marketing/` contains logo.svg, 20s demo script, one-pager md/html, and brand name ideas.

## License
You own and can ship this. Keep privacy and integrity promises intact.
