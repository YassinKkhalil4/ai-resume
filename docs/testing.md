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
  4. Validate invite gating and rate limit handling.

## Known Gaps

- No automated end-to-end tests yet (Playwright/Cypress recommended for upload → export flow).
- AI responses are not stubbed; integration tests will consume tokens unless mocked.
- Honesty scan currently heuristic; enhanced semantic scan pending (`lib/honesty.ts` placeholder).

## Adding New Tests

1. **Unit Tests:** Introduce Jest/Vitest to cover pure utility modules (`lib/ats.ts`, `lib/honesty.ts`, `lib/line-marking-parser.ts`). Configure `npm run test` and include in CI.
2. **E2E Tests:** Use Playwright in headless mode; mock OpenAI endpoints by intercepting `/api/tailor` response with fixture JSON to keep deterministic.
3. **Load Testing:** For rate-limit validation, apply k6 or autocannon against `/api/tailor` with invite headers.

## CI Recommendations

- Lint + typecheck on every PR.
- Run QA harness nightly (token-free) to detect regressions in keyword extraction.
- Optionally enforce PDF render smoke test by running export route via containerised Puppeteer.

