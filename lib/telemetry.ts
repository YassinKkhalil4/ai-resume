import fs from 'fs'
import { v4 as uuid } from 'uuid'

const TELEMETRY_PATH = '/tmp/telemetry.jsonl'
const AI_RESPONSES_PATH = '/tmp/ai-responses.jsonl'
const ERROR_LOG_PATH = '/tmp/error-log.jsonl'

const LOG_DRAIN_URL = process.env.LOG_DRAIN_URL || ''
const LOG_DRAIN_KEY = process.env.LOG_DRAIN_KEY || ''

export function startTrace(meta: any = {}) {
  const id = uuid()
  const t0 = Date.now()
  
  function end(ok: boolean, extra: any = {}) {
    const rec = { 
      req_id: id,
      route: meta.route || 'unknown',
      timing: Date.now() - t0,
      timestamp: new Date().toISOString(),
      final_status: ok ? 'success' : 'error',
      ...meta, 
      ...extra 
    }
    try { 
      fs.appendFileSync(TELEMETRY_PATH, JSON.stringify(rec) + '\n') 
    } catch (e) {
      console.warn('Failed to write telemetry:', e)
    }
    void sendToDrain(rec)
    return rec
  }
  
  return { id, end }
}

export function logAIResponse(attempt: number, success: boolean, error?: string, responseLength?: number, model?: string) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'ai_response',
    attempt,
    success,
    error: error?.substring(0, 500), // Truncate long errors
    responseLength,
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }
  
  try {
    fs.appendFileSync(AI_RESPONSES_PATH, JSON.stringify(logEntry) + '\n')
  } catch (e) {
    console.warn('Failed to log AI response:', e)
  }
  void sendToDrain(logEntry)
}

export function logError(error: Error, context: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'error',
    message: error.message,
    stack: error.stack,
    context: JSON.stringify(context)
  }
  
  try {
    fs.appendFileSync(ERROR_LOG_PATH, JSON.stringify(logEntry) + '\n')
  } catch (e) {
    console.warn('Failed to log error:', e)
  }
  void sendToDrain(logEntry)
}

export function logPDFGeneration(attempt: number, success: boolean, error?: string, method?: string, size?: number) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'pdf_generation',
    attempt,
    success,
    error: error?.substring(0, 500),
    method,
    size
  }
  
  try {
    fs.appendFileSync(TELEMETRY_PATH, JSON.stringify(logEntry) + '\n')
  } catch (e) {
    console.warn('Failed to log PDF generation:', e)
  }
  void sendToDrain(logEntry)
}

export function logSessionActivity(sessionId: string, activity: string, details: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'session_activity',
    sessionId,
    activity,
    details: JSON.stringify(details)
  }
  
  try {
    fs.appendFileSync(TELEMETRY_PATH, JSON.stringify(logEntry) + '\n')
  } catch (e) {
    console.warn('Failed to log session activity:', e)
  }
  void sendToDrain(logEntry)
}

export function logRequestTelemetry(data: {
  req_id: string
  route: string
  timing: number
  model_tokens?: number
  pdf_launch_ms?: number
  pdf_render_ms?: number
  docx_ms?: number
  final_status: 'success' | 'error'
  was_snapshot_used?: boolean
  error_code?: string
  additional_metrics?: any
}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'request_telemetry',
    ...data
  }
  
  try {
    fs.appendFileSync(TELEMETRY_PATH, JSON.stringify(logEntry) + '\n')
  } catch (e) {
    console.warn('Failed to log request telemetry:', e)
  }
  void sendToDrain(logEntry)
}

async function sendToDrain(entry: any) {
  if (!LOG_DRAIN_URL) return
  try {
    await fetch(LOG_DRAIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(LOG_DRAIN_KEY ? { 'Authorization': `Bearer ${LOG_DRAIN_KEY}` } : {})
      },
      body: JSON.stringify(entry)
    })
  } catch {}
}
