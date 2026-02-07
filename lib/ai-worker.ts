/**
 * BullMQ worker for processing AI requests
 * Can be run as a separate process or as an API route handler
 */

import { Worker, WorkerOptions, Job } from 'bullmq'
import { getRedisClient, isRedisAvailable } from './redis'
import { getTailoredResume } from './ai-response-parser'
import { extractBulletsFromFreeText } from './ai-response-parser'
import { AIJobData, AIJobResult } from './ai-queue'

// Feature flag to use queue
const USE_QUEUE = process.env.USE_AI_QUEUE !== 'false' && isRedisAvailable()

let _worker: Worker<AIJobData, AIJobResult> | null = null

/**
 * Get or create the AI worker instance
 */
export function getAIWorker(): Worker<AIJobData, AIJobResult> | null {
  if (!USE_QUEUE) {
    return null
  }

  if (_worker) {
    return _worker
  }

  const redis = getRedisClient()
  if (!redis) {
    return null
  }

  // For Upstash, we can't use BullMQ worker directly
  // We'll process jobs via API route instead
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return null
  }

  try {
    const workerOptions: WorkerOptions = {
      connection: {
        host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : undefined,
        port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port || '6379') : undefined,
      },
      concurrency: 3, // Process up to 3 jobs concurrently
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // Per minute (to respect OpenAI rate limits)
      },
    }

    _worker = new Worker<AIJobData, AIJobResult>('ai-requests', processAIJob, workerOptions)

    _worker.on('completed', (job) => {
      console.log(`AI job ${job.id} completed`)
    })

    _worker.on('failed', (job, err) => {
      console.error(`AI job ${job?.id} failed:`, err)
    })

    _worker.on('error', (err) => {
      console.error('AI worker error:', err)
    })

    console.log('AI worker initialized')
    return _worker
  } catch (error) {
    console.error('Failed to initialize AI worker:', error)
    return null
  }
}

/**
 * Process an AI job
 * This function is called by the worker for each job
 */
async function processAIJob(job: Job<AIJobData, AIJobResult>): Promise<AIJobResult> {
  const { type, original, jdText, tone, options, freeText } = job.data

  try {
    switch (type) {
      case 'tailor':
        const result = await getTailoredResume(original, jdText, tone, options || {})
        return {
          tailored: result.tailored,
          tokens: result.tokens,
          ats: result.ats,
        }

      case 'extract-experience':
        // Only triggered by explicit user action (e.g. paste experience); never automatic (AI hallucination prevention).
        if (!freeText) {
          throw new Error('freeText required for extract-experience')
        }
        const experience = await extractBulletsFromFreeText(freeText)
        return {
          experience,
          tokens: 0, // Extract doesn't return tokens currently
        }

      case 'handle-missing':
        // This would call handleMissingExperience if it exists
        // For now, just return error
        throw new Error('handle-missing not yet implemented')

      default:
        throw new Error(`Unknown job type: ${type}`)
    }
  } catch (error) {
    console.error(`AI job ${job.id} processing error:`, error)
    throw error // Re-throw to mark job as failed
  }
}

/**
 * Process a job directly (for API route processing when worker is not available)
 * Useful for Upstash or when running in serverless environments
 */
export async function processAIJobDirect(data: AIJobData): Promise<AIJobResult> {
  return processAIJob({
    id: 'direct',
    data,
    // Minimal job object for direct processing
  } as Job<AIJobData, AIJobResult>)
}

/**
 * Start the worker (call this in a separate process or API route)
 */
export function startWorker() {
  const worker = getAIWorker()
  if (worker) {
    console.log('AI worker started')
  } else {
    console.warn('AI worker not available (Redis not configured or using Upstash)')
  }
}

/**
 * Stop the worker gracefully
 */
export async function stopWorker() {
  if (_worker) {
    await _worker.close()
    _worker = null
    console.log('AI worker stopped')
  }
}

