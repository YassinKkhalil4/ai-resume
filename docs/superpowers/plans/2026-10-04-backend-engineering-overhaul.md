# Backend Engineering Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix correctness, security and structural defects in the backend (API routes, billing, auth, sessions, rate limiting) without touching frontend design/UI.

**Architecture:** Keep Next.js route handlers thin; move logic into small, testable `lib/` units with injectable dependencies (Redis client, credit functions). DB-backed behaviour is tested against a throwaway Postgres (`TEST_DATABASE_URL`); tests skip cleanly when it is unset. Redis behaviour is tested against an in-memory fake injected via `setRedisClientForTesting`.

**Tech Stack:** Next.js 15 route handlers, drizzle-orm + postgres-js, ioredis/Upstash, next-auth v4, `node:test` + `tsx`.

## Global Constraints

- No changes to `components/`, `app/**/page.tsx`, `app/globals.css`, or any visual/UX copy. Response JSON shapes consumed by the frontend stay backwards compatible.
- Do not modify `node_modules` or `package.json` dependencies.
- Every behaviour change starts with a failing test (TDD). Pure deletions of dead/unsafe code are the only exception.
- `npm test`, `npm run typecheck`, `npm run lint` must pass at the end.

---

## Findings (evidence from code review)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| F1 | Critical | Unauthenticated path traversal: `GET /api/export/<file>` reads and **deletes** `/tmp/${file}`. Nothing references it. | `app/api/export/[file]/route.ts` |
| F2 | High | Job status endpoint is unauthenticated and BullMQ job ids are sequential, so job results (tailored resumes) are readable by anyone. The queue has no worker anywhere in the repo, so the queue path just burns the 30 s budget. `tailor/process` and the Upstash "simple queue" are dead. | `lib/ai-queue.ts`, `lib/ai-worker.ts`, `app/api/tailor/{status,process}`, `app/api/tailor/route.ts:364-402` |
| F3 | High | Nothing sets the `sid` cookie, so `sessionID()` is always `'anon'`: the per-session rate limit (default 5/min) is **one global bucket for all users**. | `lib/guards.ts:36` |
| F4 | High | Admin "set credits" writes `users.credits_remaining` only. Balance and spending use `credit_lots`, so admin grants have no effect; negative values accepted. | `app/api/admin/users/route.ts:128-165` |
| F5 | High | Email verification code is 6 digits from `Math.random()`, with no attempt limit; tokens are consumed non-atomically. | `lib/auth/verification.ts` |
| F6 | High | Sessions have no owner. Any caller who knows a session id can read/overwrite it via diff/honesty/process-* routes. Session `version` is `base64(JSON).slice(0,16)`, i.e. a constant for every session, so version checks never fire. | `lib/sessions.ts` |
| F7 | Medium | `POST /api/auth/change-password` returns 500 when unauthenticated (`requireAuth` throws, caught as generic error). | `app/api/auth/change-password/route.ts` |
| F8 | Medium | Emails are case-sensitive (duplicates/free-credit farming); signup has no password length rule or rate limit; `/api/auth/login` is an unthrottled password oracle and is unused by the frontend. | `app/api/auth/*`, `lib/auth/config.ts` |
| F9 | Medium | Google sign-in links to an existing unverified password account without clearing the password hash (pre-hijack). | `lib/auth/config.ts:84-106` |
| F10 | Medium | `/api/events`, `/api/contact` have no rate limit or size caps; `/api/billing/create-checkout-session` never calls the existing purchase rate limiter; `jd_text`, `experienceText`, `resumeText` have no length caps (unbounded OpenAI spend); `tone` is not validated before reaching the prompt; `/api/admin/config` merges an unvalidated body. | various |
| F11 | Medium | Credit reserve/commit/release logic is copy-pasted in 3 routes; a failed `usage_logs` insert after a successful tailor releases the credit (free run). Refund webhook updates lots with read-then-write (races with spending). | `app/api/{tailor,process-experience,process-line-selections}`, `webhook/route.ts:206-218` |
| F12 | Low | `tailor/route.ts` creates a trace row before validating content type; dead try/catch; `userCache` Map grows without bound. | `app/api/tailor/route.ts:62-80`, `lib/auth/utils.ts` |
| F13 | Info (not fixed here) | Two overlapping run tables (`tailor_runs` vs `tailoring_runs`); 2,087-line `lib/ai-response-parser.ts`; ~15 stale docs; legacy `tests/test-*.js` scripts not run in CI; `users.credits_remaining` is a denormalised cache that drifts on lot expiry. Documented as follow-ups. |

Test coverage today: 6 tests (webhook signature, checkout URL, variant mapping, upload validation, SSRF, TXT parse). Nothing covers credits, sessions, rate limiting, auth, or route handlers.

---

### Task 1: Test infrastructure

**Files:** Modify `lib/redis.ts`, `package.json` (test script); Create `tests/helpers/fake-redis.ts`, `tests/helpers/db.ts`, `tests/infra.test.ts`

**Interfaces — Produces:**
- `setRedisClientForTesting(client: RedisClient | null): void` in `lib/redis.ts`
- `createFakeRedis(): RedisClient` (in-memory get/set/setex/del/ttl/expire/incr/zadd/zcard/zremrangebyscore/keys/exists/lpush/rpop/decr)
- `getTestDb(): Promise<{ skip: string | false }>` skipping when `TEST_DATABASE_URL` is unset; `resetDb()` truncating mutable tables.

- [ ] Write failing test that injects the fake and expects `getRedisClient()` to return it.
- [ ] Implement injection, fake, db helper; change `test` script to `node --import tsx --test tests/*.test.ts`.
- [ ] Run suite; commit.

### Task 2: Remove unsafe/dead surfaces (F1, F2)

**Files:** Delete `app/api/export/[file]/route.ts`, `app/api/tailor/status/[jobId]/route.ts`, `app/api/tailor/process/route.ts`, `lib/ai-queue.ts`, `lib/ai-worker.ts`; Modify `app/api/tailor/route.ts` (always call `getTailoredResume` directly).

- [ ] Confirm no importers (`grep`), delete, simplify tailor route, `npm run typecheck`, commit.

### Task 3: Sessions with owner and real version (F6)

**Files:** Modify `lib/sessions.ts`, `app/api/diff/route.ts`, `app/api/honesty/route.ts`, `app/api/process-experience/route.ts`, `app/api/process-line-selections/route.ts`, `app/api/tailor/route.ts`; Test `tests/sessions.test.ts`

**Interfaces — Produces:** `createSession(original, tailored, jdText, keywordStats, originalRawText, ownerId)` (new trailing `ownerId: string`); `getSession(id)`; `getOwnedSession(id, userId): Promise<Session | null>` (null when missing or owned by someone else); `computeSessionVersion(original, tailored): string` (sha256 hex, first 16).

- [ ] Failing tests: versions differ for different content and are stable for equal content; `getOwnedSession` returns null for a different user and for legacy sessions without an owner.
- [ ] Implement; routes use `getOwnedSession`; diff/honesty require login and only compare versions when falling back to the stored session.
- [ ] Commit.

### Task 4: Rate-limit identity (F3, part of F10)

**Files:** Modify `lib/guards.ts`; Test `tests/guards.test.ts`

**Interfaces — Produces:** `rateLimitSessionKey(req)`: `sid:<cookie>` if the cookie is present, else `ip:<ip>`. (Executed deviation: no `user:` tier — guards run before auth and a per-request session lookup would add a DB query to every call.)

- [ ] Failing test: two requests without cookie from different IPs map to different keys; cookie wins over IP; user wins over cookie.
- [ ] Implement, use it in `enforceGuards`; commit.

### Task 5: Credits core (F4, F11)

**Files:** Create `lib/billing/credit-plan.ts`, `lib/billing/with-credit.ts`; Modify `lib/billing/deduct-credit.ts`, `app/api/admin/users/route.ts`, `app/api/billing/webhook/route.ts`, the 3 tailoring routes; Test `tests/credits.test.ts`, `tests/webhook.test.ts` (DB)

**Interfaces — Produces:**
- `planDeduction(lots: {id: string; creditsRemaining: number}[], amount: number): { id: string; take: number }[]` pure, oldest first, never over-takes.
- `setUserCredits(userId: string, target: number): Promise<{ before: number; after: number }>` in `lib/billing/deduct-credit.ts`, in one transaction: positive delta inserts an `admin` lot (1y expiry), negative delta deducts via `planDeduction` with atomic SQL, then recomputes `users.credits_remaining` from lots.
- `withCreditReservation<T>(deps, userId, hash, work: () => Promise<{ result: T; tokens?: number }>): Promise<T>` — reserves, runs, commits; on error releases; a failed commit (usage log) is logged and does **not** release.

- [ ] Failing unit tests for `planDeduction` and `withCreditReservation` (fake deps).
- [ ] Failing DB tests: `setUserCredits` up/down/negative-rejected; concurrent `reserveCredit` never overspends; refund webhook revokes atomically and is idempotent.
- [ ] Implement; admin PATCH validates integer 0..100000 and calls `setUserCredits`; refund uses atomic `greatest(0, remaining - x)`; routes use `withCreditReservation`.
- [ ] Commit.

### Task 6: Auth hardening (F5, F7, F8, F9)

**Files:** Create `lib/auth/email.ts`, `lib/auth/password.ts`; Modify `lib/auth/verification.ts`, `lib/auth/config.ts`, `app/api/auth/{signup,verify,resend-verification,change-password}/route.ts`; Delete `app/api/auth/login/route.ts`; Test `tests/auth.test.ts` (DB for verification)

**Interfaces — Produces:** `normalizeEmail(e: string): string` (trim + lowercase); `validatePassword(p: unknown): { ok: true } | { ok: false; message: string }` (string, 8–72 bytes); verification codes via `crypto.randomInt`; `validateVerificationCode` with atomic consume (`UPDATE … WHERE used_at IS NULL RETURNING`) and max 5 wrong attempts / 15 min / user via Redis.

- [ ] Failing tests per helper and per behaviour (double-consume returns invalid; 6th wrong code blocked; change-password unauthenticated is 401).
- [ ] Implement; Google callback clears `password_hash` when linking an unverified password account and requires `profile.email_verified`.
- [ ] Commit.

### Task 7: Input limits and abuse controls (F10)

**Files:** Create `lib/validation.ts`; Modify `app/api/{tailor,process-experience,process-line-selections,contact,events,admin/config,billing/create-checkout-session}/route.ts`, `lib/config.ts`; Test `tests/validation.test.ts`

**Interfaces — Produces:** `parseTone(v: unknown): Tone` (falls back to `'professional'`); `LIMITS = { jdChars: 20000, experienceChars: 30000, resumeChars: 60000, contactMessage: 5000, eventProps: 4000 }`; `exceedsLimit(v: unknown, max: number): boolean`; `adminConfigSchema` (zod) accepting only `rate.ipPerMin/sessionPerMin` (1–1000), `pauseTailor`, `pauseExport`.

- [ ] Failing tests; implement; wire into routes (413/400 with existing `{code,message}` shape); checkout uses `checkPurchaseRateLimit`; contact/events use `checkUrlFetchRateLimit`-style IP limiter.
- [ ] Commit.

### Task 8: Tailor route hygiene (F12)

**Files:** Modify `app/api/tailor/route.ts`, `lib/auth/utils.ts`

- [ ] Move `createTailorRun` after content-type/form validation, remove dead try/catch, bound `userCache` (prune on insert).
- [ ] Commit.

### Task 9: Final verification

- [ ] `npm test` (with and without `TEST_DATABASE_URL`), `npm run typecheck`, `npm run lint`; update `docs/testing.md` with the test DB recipe; record follow-ups (F13).

## Execution notes (deviations)

- Task 4 also made `lib/db` lazy (`db` is now a Proxy; `closeDb()` added) because importing `guards` threw without `DATABASE_URL`.
- Task 5 also fixed `getUserCredits` returning a string (pg `sum` is numeric) and validated the webhook's `custom_data.user_id` as a UUID.
- Task 6 added `lib/auth/users.ts#findUserByEmail` (case-insensitive) and a generic `checkNamedRateLimit`.
- Task 7: `createTailorRun` reorder and the refund `FOR UPDATE` lock are refactors/hardening without their own red test (need a live end-to-end run / true concurrency).
- `npm test` runs files serially (`--test-concurrency=1`) so DB-backed files do not truncate each other's rows.

## Self-review

Every finding F1–F12 maps to Tasks 2–8; F13 is explicitly deferred. Signatures used across tasks (`createSession` owner arg, `getOwnedSession`, `withCreditReservation`, `setUserCredits`, `parseTone`, `normalizeEmail`) are each defined once in their producing task.
