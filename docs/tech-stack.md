# Tech Stack & Dependencies

## Languages & Frameworks

- **TypeScript 5.5** – type-safe frontend + backend code.
- **Next.js 14.2 (App Router)** – React 18 SSR/CSR hybrid with API routes.
- **React 18.3** – client components and hooks for UI state.
- **Tailwind CSS 3.4** – utility-first styling.

## Backend / Services

- **Node.js 20** – runtime for Next.js API routes and tooling.
- **OpenAI Node SDK 4.52** – Chat Completions client.
- **Puppeteer 22.11** – headless Chrome fallback for PDF rendering.
- **FilePond** – file upload handling in the browser.

## Key Libraries

| Purpose | Library | License |
|---------|---------|---------|
| Schema validation | `zod` 3.23 | MIT |
| Resume parsing | `pdfjs-dist`, `mammoth` | Apache 2.0 / MIT |
| Diff visualisation | `diff` 5.2 | BSD-3-Clause |
| Sanitisation | `sanitize-html` 2.17 | MIT |
| Telemetry utilities | `uuid` 9.0 | MIT |
| Export conversion | `html-docx-js` 0.3 | MIT |

## Dev Tooling

- **ESLint 8.57** with `eslint-config-next` – linting.
- **TypeScript Compiler (`npm run typecheck`)** – static analysis.
- **tsx 4.16** – TypeScript execution for QA scripts.

## Optional Integrations

- **External PDF Renderer** – pluggable via `PDF_RENDERER_URL` (e.g., DocRaptor, CloudConvert).
- **Log Drain** – send telemetry to Datadog, Splunk, or self-hosted ELK via `LOG_DRAIN_URL`.

## Licensing Notes

- All dependencies are permissively licensed (MIT/BSD/Apache). No copyleft components.
- Verify licensing terms for external PDF service providers separately.
- OpenAI API usage subject to OpenAI terms of service.

