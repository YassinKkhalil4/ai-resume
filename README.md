# AI Resume Tailor — v2 (Complete)

Upload resume (PDF/DOCX/TXT) → paste JD text/URL → tailor bullets with guardrails → preview diffs + ATS → honesty scan → export ATS-safe PDF/DOCX.
Privacy-first (no persistence), invite-only + rate limits, admin console, telemetry, QA harness, and marketing kit.

## Quickstart

```bash
pnpm i || npm i || yarn
cp .env.example .env.local
# set OPENAI_API_KEY=...
npm run dev
# open http://localhost:3000
```

### Deploy
- **Vercel**: set `USE_LAMBDA_CHROMIUM=1` and function memory 1024 MB for serverless PDF.
- **Render/VM/Docker**: `puppeteer` works without the serverless build.
- **Docker**:
  ```bash
  docker build -t ai-resume-tailor .
  docker run -p 3000:3000     -e OPENAI_API_KEY=sk-...     -e INVITE_CODES=alpha123,beta456     -e ADMIN_KEY=supersecret     -e USE_LAMBDA_CHROMIUM=0     ai-resume-tailor
  ```

## Privacy & Integrity
- **Files deleted immediately** after text extraction; sessions are in-memory for 60 minutes.
- **No fabricated credentials**: enforced by prompts + integrity check + honesty scan.
- See `/privacy` page for user-facing copy.

## Access Control & Abuse
- **Invite-only**: `INVITE_CODES` env; API checks `x-invite-code` header or `invite` cookie.
- **Rate limits**: per-IP and per-session sliding window (defaults: 30/min IP, 5/min session).
- **Admin console** (`/admin`): tune rate limits, invites, and runtime OpenAI key (stored in `/tmp`).

> Security: Gate `/admin` behind VPN/SAML in production or store config in a real DB/KV.

## Telemetry
- Correlation ids, latency, token usage logged to `/tmp/telemetry.jsonl`. Replace with your logger.

## API
- `POST /api/tailor` — FormData `{ resume_file, jd_text|jd_url, tone? }` → `{ session_id, preview_sections_json, original_sections_json, diffs, keyword_stats }`
- `POST /api/export` — JSON `{ session_id, template, format: "pdf"|"docx", options }` → `{ download_url }`
- `GET /api/export/[file]` — download the file created above.
- `POST /api/honesty` — `{ session_id }` → `{ flags: [...] }`

## QA Harness
- `qa/` includes 10×10 fixtures and a baseline coverage script: `npm run qa` → `qa/results/` + `qa/summary.md`

## Marketing
- `marketing/` contains logo.svg, 20s demo script, one-pager md/html, and brand name ideas.

## License
You own and can ship this. Keep privacy and integrity promises intact.
