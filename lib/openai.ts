import OpenAI from 'openai'
import { getConfig } from './config'

let client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export function getOpenAI() {
  const cfg = getConfig()
  if (cfg.openaiKey) {
    client = new OpenAI({ apiKey: cfg.openaiKey })
  }
  return client
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
