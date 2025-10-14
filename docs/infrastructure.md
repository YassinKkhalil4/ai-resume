# Infrastructure Setup Guide

## Prerequisites

- Node.js 20.x, npm (or pnpm/yarn) for local builds.
- Access to an OpenAI API key (and optional project/org IDs).
- Optional external PDF renderer endpoint + API key.
- Domain + TLS termination if self-hosting.

## 1. Environment Configuration

1. Copy `.env.example` → `.env.local` (development) or provide env vars at deploy time.
2. Required variables:
   - `OPENAI_API_KEY` – primary key for tailoring/extraction calls.
   - `INVITE_CODES` – comma-separated list gating access.
   - `ADMIN_KEY` – secret used by `/api/admin/login`.
3. Optional:
   - `PDF_RENDERER_URL`, `RENDERER_KEY` – external HTML→PDF service.
   - `LOG_DRAIN_URL`, `LOG_DRAIN_KEY` – ship telemetry off-box.
   - `RATE_IP_PER_MIN`, `RATE_SESSION_PER_MIN` – override rate limits.

## 2. Local Development

```bash
npm install
npm run dev
# open http://localhost:3000
```

- Sessions, config, and telemetry write to `/tmp` (auto-cleaned on restart).
- Use `/admin` with `ADMIN_KEY` to tweak invites & rate limits locally.

## 3. Containerised Deployment (Private Server)

1. Build image:
   ```bash
   docker build -t ai-resume-tailor .
   ```
2. Run container:
   ```bash
   docker run -d --name resume-tailor \
     -p 3000:3000 \
     -e OPENAI_API_KEY=sk-... \
     -e INVITE_CODES=alpha123,beta456 \
     -e ADMIN_KEY=supersecret \
     -e PDF_RENDERER_URL=https://pdf-service.internal \
     -e RENDERER_KEY=renderer-secret \
     ai-resume-tailor
   ```
3. Front with reverse proxy (Caddy, Nginx, Traefik) to terminate TLS and add basic auth if required.
4. Persist logs by mounting `/tmp` to host tmpfs if you need to inspect telemetry.

### Scaling Considerations

- For redundancy, run multiple containers behind a load balancer. Replace `lib/sessions.ts` with Redis to share sessions.
- Use process managers (systemd, Docker Compose, Kubernetes Deployment) to auto-restart on failure.

## 4. Managed Cloud Options

### Vercel
- Link repo, set environment variables in Project Settings.
- Functions memory/timeouts defined in `vercel.json`; adjust for heavier resumes.
- For PDF generation, either:
  - Deploy a companion serverless function hitting a third-party renderer.
  - Enable `USE_LAMBDA_CHROMIUM=1` for headless Chrome builds.

### AWS/GCP/Azure (Example: AWS ECS Fargate)
1. Push Docker image to ECR.
2. Create Fargate service with desired vCPU/memory (1 vCPU / 2 GB Ram recommended).
3. Configure Application Load Balancer with HTTPS.
4. Store secrets in AWS Secrets Manager; map to environment variables.
5. Use CloudWatch logs or ship to observability stack.

## 5. Observability & Operations

- **Telemetry Files:** `/tmp/telemetry.jsonl`, `/tmp/ai-responses.jsonl`, `/tmp/error-log.jsonl`.
- **Health Checks:** `/api/health/pdf` exposes renderer metrics and alerting state.
- **Admin Console:** `/admin` to pause tailoring/export or rotate invite codes in realtime.
- **Alerting:** Configure `MONITORING_WEBHOOK_URL` and `ALERT_EMAIL` for PDF failure notifications.

## 6. Security Hardening

- Enforce HTTPS and HSTS at the proxy layer.
- Restrict `/admin` behind VPN/SAML or additional auth.
- Regularly rotate `ADMIN_KEY` and invite codes.
- Set explicit CORS policy if integrating with external clients.

