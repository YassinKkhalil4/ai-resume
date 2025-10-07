import OpenAI from 'openai'
import { getConfig } from './config'

let client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID,   // needed for sk-proj- keys
  organization: process.env.OPENAI_ORG_ID   // optional
})

export function getOpenAI() {
  const cfg = getConfig()
  if (cfg.openaiKey) {
    client = new OpenAI({
      apiKey: cfg.openaiKey,
      project: process.env.OPENAI_PROJECT_ID,
      organization: process.env.OPENAI_ORG_ID
    })
  }
  return client
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
