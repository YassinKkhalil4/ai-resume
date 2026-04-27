import OpenAI from 'openai'

// Base client uses the static env key.
// If an admin overrides the key at runtime via Redis-backed config,
// call refreshOpenAIClient() (awaitable) before the first AI call in that request.
let client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID,   // needed for sk-proj- keys
  organization: process.env.OPENAI_ORG_ID   // optional
})

export function getOpenAI() {
  return client
}

/**
 * Call once per request (before getTailoredResume) to pick up a runtime key
 * set by the admin via the config API.  Intentionally async so it can read Redis.
 */
export async function refreshOpenAIClient(): Promise<void> {
  try {
    const { getConfig } = await import('./config')
    const cfg = await getConfig()
    if (cfg.openaiKey) {
      client = new OpenAI({
        apiKey: cfg.openaiKey,
        project: process.env.OPENAI_PROJECT_ID,
        organization: process.env.OPENAI_ORG_ID
      })
    }
  } catch {
    // Non-fatal — fall back to the static env key
  }
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
