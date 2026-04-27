import { getRedisClient } from './redis'

const CONFIG_KEY = 'tailora:app_config'

export type AppConfig = {
  rate: { ipPerMin: number; sessionPerMin: number }
  invites: string[]
  openaiKey?: string
  pauseTailor?: boolean
  pauseExport?: boolean
}

export type ExternalCheckoutConfig = {
  starter: string
  jobSeeker: string
  powerApply: string
  careerCoach: string
}

// Boot-time defaults from environment variables
const defaults: AppConfig = {
  rate: {
    ipPerMin: Number(process.env.RATE_IP_PER_MIN || 30),
    sessionPerMin: Number(process.env.RATE_SESSION_PER_MIN || 5),
  },
  invites: (process.env.INVITE_CODES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  openaiKey: undefined,
  pauseTailor: false,
  pauseExport: false,
}

// In-process cache: valid for 60 s to avoid a Redis round-trip on every request
let _cache: AppConfig | null = null
let _cacheAt = 0
const CACHE_TTL_MS = 60_000

export function getDefaultConfig(): AppConfig {
  return { ...defaults, rate: { ...defaults.rate } }
}

export async function loadConfig(): Promise<AppConfig> {
  const now = Date.now()
  if (_cache && now - _cacheAt < CACHE_TTL_MS) return _cache

  const redis = getRedisClient()
  if (!redis) {
    // Redis not configured — return env-driven defaults (acceptable for single-instance dev)
    console.warn('[config] Redis unavailable — using env defaults, admin config changes will not persist')
    return getDefaultConfig()
  }

  try {
    const raw = await redis.get(CONFIG_KEY)
    if (raw) {
      const stored: Partial<AppConfig> = JSON.parse(raw)
      _cache = {
        ...defaults,
        ...stored,
        rate: { ...defaults.rate, ...(stored.rate ?? {}) },
      }
    } else {
      _cache = getDefaultConfig()
    }
  } catch (err) {
    console.error('[config] Failed to read config from Redis:', err)
    _cache = getDefaultConfig()
  }

  _cacheAt = Date.now()
  return _cache!
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  const redis = getRedisClient()
  if (!redis) {
    console.warn('[config] Redis unavailable — config change will not persist across instances')
    return
  }
  try {
    // Never persist the OpenAI key to Redis — it must stay in env vars / secrets manager only.
    const { openaiKey: _omit, ...safeConfig } = cfg
    await redis.set(CONFIG_KEY, JSON.stringify(safeConfig))
    _cache = cfg // keep the full object in process memory only
    _cacheAt = Date.now()
  } catch (err) {
    console.error('[config] Failed to save config to Redis:', err)
    throw err
  }
}

export async function getConfig(): Promise<AppConfig> {
  return loadConfig()
}

export async function updateConfig(partial: Partial<AppConfig>): Promise<AppConfig> {
  const current = await loadConfig()
  const updated: AppConfig = {
    ...current,
    ...partial,
    rate: { ...current.rate, ...(partial.rate ?? {}) },
  }
  await saveConfig(updated)
  return updated
}

export function getExternalCheckoutConfig(): ExternalCheckoutConfig {
  return {
    starter: process.env.NEXT_PUBLIC_CHECKOUT_LINK_STARTER || '',
    jobSeeker: process.env.NEXT_PUBLIC_CHECKOUT_LINK_JOB_SEEKER || '',
    powerApply: process.env.NEXT_PUBLIC_CHECKOUT_LINK_POWER_APPLY || '',
    careerCoach: process.env.NEXT_PUBLIC_CHECKOUT_LINK_CAREER_COACH || '',
  }
}
