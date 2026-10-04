# Testing & Quality Assurance

## Test Commands

| Command | Description |
|---------|-------------|
| `npm run lint` | Runs ESLint across the Next.js app and API routes. |
| `npm run typecheck` | Executes `tsc --noEmit` for static typing errors. |
| `npm run qa` | Runs the custom QA harness (`qa/run.ts`) to compute baseline ATS coverage across fixture resumes/JDs. |

## Coverage Summary

- **Static Analysis:** ESLint + TypeScript guard against common bugs and type regressions.
- **Integration Scenarios:** QA harness exercises keyword extraction and ATS scoring for 100 resume/JD pairs, outputting `qa/results/baseline.json` and `qa/summary.md`.
- **Manual QA:** Recommended smoke suite:
  1. Upload DOCX + JD paste → confirm tailored preview and diff load.
  2. Trigger missing-experience banner → use paste and line-marking recovery flows.
  3. Run honesty scan + export PDF/DOCX.
  4. Validate rate limit handling.

## Known Gaps

- No automated end-to-end tests yet (Playwright/Cypress recommended for upload → export flow).
- AI responses are not stubbed; integration tests will consume tokens unless mocked.
- Honesty scan currently heuristic; enhanced semantic scan pending (`lib/honesty.ts` placeholder).

## Adding New Tests

1. **Unit Tests:** Introduce Jest/Vitest to cover pure utility modules (`lib/ats.ts`, `lib/honesty.ts`, `lib/line-marking-parser.ts`). Configure `npm run test` and include in CI.
2. **E2E Tests:** Use Playwright in headless mode; mock OpenAI endpoints by intercepting `/api/tailor` response with fixture JSON to keep deterministic.
3. **Load Testing:** For rate-limit validation, apply k6 or autocannon against `/api/tailor`.

## CI Recommendations

- Lint + typecheck on every PR.
- Run QA harness nightly (token-free) to detect regressions in keyword extraction.
- Optionally enforce PDF render smoke test by running export route via containerised Puppeteer.

## Automated backend tests (`npm test`)

`npm test` runs every `tests/*.test.ts` with `node:test` + `tsx`, one file at a time
(`--test-concurrency=1`, because DB-backed files share one database).

- Redis behaviour is tested against an in-memory fake (`tests/helpers/fake-redis.ts`) injected with `setRedisClientForTesting`.
- DB-backed tests (credits, webhook, auth, abuse controls) run only when `TEST_DATABASE_URL` is set; otherwise they are reported as skipped.

Throwaway database recipe (never point this at real data; the tests `TRUNCATE users … CASCADE`):

```bash
initdb -D /tmp/rolefit-pg -U test --auth=trust
pg_ctl -D /tmp/rolefit-pg -o "-p 55432 -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start
psql -h 127.0.0.1 -p 55432 -U test -d postgres -c "create database rolefit_test"
for f in drizzle/000*.sql; do sed 's/--> statement-breakpoint//' "$f" | psql -h 127.0.0.1 -p 55432 -U test -d rolefit_test -q -v ON_ERROR_STOP=1; done
TEST_DATABASE_URL=postgres://test@127.0.0.1:55432/rolefit_test npm test
```
