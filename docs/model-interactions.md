# AI Model Interaction Summary

## Model Inventory

| Use Case | Entry Point | Model | Purpose | Typical Tokens |
|----------|-------------|-------|---------|----------------|
| Resume tailoring | `lib/ai-response-parser.getTailoredResume` | `gpt-4o-mini` (configurable via `OPENAI_MODEL`) | Rewrite resume bullets aligned to JD with integrity guardrails | 1.2k input / 0.6k output |
| Experience extraction | `lib/ai-response-parser.extractBulletsFromFreeText` | `gpt-4o-mini` | Structure pasted text into role/bullet JSON | 0.8k input / 0.4k output |
| Line selection enrichment (fallback) | `lib/ai-response-parser.handleMissingExperience` | `gpt-4o-mini` | Derive experience when original resume lacks bullet structure | 0.9k input / 0.4k output |

> **Note:** All requests use the OpenAI Chat Completions API with `response_format: { type: "json_object" }` to enforce structured outputs.

## Invocation & Prompting

- **System Prompt:** `lib/prompts.ts` encodes strict non-fabrication rules:
  - Never invent employers, roles, metrics, or tools.
  - Only rephrase existing content using resume/JD vocabulary.
- **User Prompt:** Injects canonicalised resume JSON, JD text, and tone setting into a deterministic instruction block.
- **Tone Control:** `professional | concise | impact-heavy` tone passed from UI; influences writing style but not content expansion.
- **Retry Logic:** `parseAIResponse` retries up to 3 times with exponential backoff, coercing malformed JSON into the Zod schema (`lib/schemas.ts`).
- **Post-Processing:**
  - Missing experience triggers AI-assisted extraction before final tailoring.
  - Honesty scan (`lib/honesty.ts`) compares tailored bullets against original text to flag low-overlap statements.

## Rate Limiting & Error Handling

- **Client Guardrails:** `lib/guards.ts` enforces per-IP and per-session limits (default 30/5 req per minute).
- **OpenAI Errors:** Logged via `lib/telemetry.logAIResponse` and surfaced with user-friendly messages (`lib/ai-error-handler.ts`).
- **Fallback Behaviour:** If all AI attempts fail, `createFallbackResponse` returns original content with lightweight keyword ordering.

## Cost & Performance Optimisations

- **Token Budgeting:** `max_tokens` set to 8k to accommodate long resumes; typical usage stays under 2k tokens to maintain ~$0.02 run cost.
- **Response Caching:** Sessions store tailored JSON to avoid re-requesting the model when refreshing diffs or honesty scans.
- **Batching:** Each tailoring request is handled individually to honour per-candidate privacy; bulk processing can be layered on top of existing API.

## Extensibility Hooks

- Swap `OPENAI_MODEL` to any Chat Completions model supporting JSON mode (e.g., `gpt-4o-mini`, `gpt-4.1-mini`).
- To integrate other providers, replace `lib/openai.ts` with an adapter exposing `chat.completions.create`.
- Add semantic honesty scan by implementing `enhancedHonestyScan` in `lib/honesty.ts` (currently a placeholder for embedding-based checks).

