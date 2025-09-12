import fs from 'fs'
const CONFIG_PATH = '/tmp/ai-resume-tailor-config.json'

export type AppConfig = {
  rate: { ipPerMin: number, sessionPerMin: number },
  invites: string[],
  openaiKey?: string
}

let config: AppConfig = {
  rate: { ipPerMin: Number(process.env.RATE_IP_PER_MIN||30), sessionPerMin: Number(process.env.RATE_SESSION_PER_MIN||5) },
  invites: (process.env.INVITE_CODES||'').split(',').map(s=>s.trim()).filter(Boolean),
  openaiKey: undefined
}

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
      const fileCfg = JSON.parse(raw)
      config = { ...config, ...fileCfg }
    }
  } catch {}
}

export function saveConfig() {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)) } catch {}
}

export function getConfig(): AppConfig { return config }

export function updateConfig(partial: Partial<AppConfig>) {
  config = { ...config, ...partial, rate: { ...config.rate, ...(partial.rate||{}) } }
  saveConfig()
}
loadConfig()
