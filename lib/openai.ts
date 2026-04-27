import OpenAI from 'openai'

let client: OpenAI | null = null

function createOpenAIClient(apiKey?: string) {
  const key = apiKey || process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  return new OpenAI({
    apiKey: key,
    project: process.env.OPENAI_PROJECT_ID || undefined,
    organization: process.env.OPENAI_ORG_ID || undefined,
  })
}

export function getOpenAI() {
  if (!client) {
    client = createOpenAIClient()
  }
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
      client = createOpenAIClient(cfg.openaiKey)
    }
  } catch {
    // Non-fatal — fall back to the static env key
  }
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
