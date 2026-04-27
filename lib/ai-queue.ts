/**
 * AI request queue system
 * Manages OpenAI API calls with queuing, retries, and rate limit handling
 * Supports both standard Redis (with BullMQ) and Upstash (with simple queue)
 */

import { Queue, QueueOptions, QueueEvents, Job } from 'bullmq'
import { getRedisClient, isRedisAvailable, getRedisType } from './redis'
import { ResumeJSON, KeywordStatsComparison } from './types'
import { TailoredResultType } from './schemas'

// Feature flag to use queue (defaults to true if Redis is available)
const USE_QUEUE = process.env.USE_AI_QUEUE !== 'false' && isRedisAvailable()

export interface AIJobData {
  type: 'tailor' | 'extract-experience' | 'handle-missing'
  original: ResumeJSON
  jdText: string
  tone: 'professional' | 'concise' | 'impact-heavy'
  options?: {
    deadline?: number
    runId?: string | null
    strictHonestyMode?: boolean
  }
  freeText?: string // For extract-experience
}

export interface AIJobResult {
  tailored?: TailoredResultType
  experience?: ResumeJSON['experience']
  tokens: number
  ats?: KeywordStatsComparison
  error?: string
}

let _queue: Queue<AIJobData, AIJobResult> | null = null
let _queueEvents: QueueEvents | null = null
let _useSimpleQueue = false // Use simple queue for Upstash

/**
 * Get or create the AI queue instance
 * Uses BullMQ for standard Redis, simple queue for Upstash REST API
 */
export function getAIQueue(): Queue<AIJobData, AIJobResult> | null {
  if (!USE_QUEUE) {
    return null
  }

  if (_queue) {
    return _queue
  }

  const redis = getRedisClient()
  if (!redis) {
    console.warn('Redis not available for AI queue, falling back to direct calls')
    return null
  }

  const redisType = getRedisType()

  // Upstash uses a REST API — BullMQ and its worker model are incompatible.
  // The "simple queue" approach (lpush + polling) had no worker to process jobs,
  // so every enqueued job silently timed out. Disable queuing entirely for Upstash
  // and always fall back to direct synchronous calls.
  if (redisType === 'upstash') {
    _useSimpleQueue = false
    return null
  }

  try {
    // For standard Redis, use BullMQ with IORedis connection
    // BullMQ requires an IORedis instance, not a URL string
    const Redis = require('ioredis')
    const connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
    })

    const queueOptions: QueueOptions = {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep last 100 jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    }

    _queue = new Queue<AIJobData, AIJobResult>('ai-requests', queueOptions)
    
    // Initialize QueueEvents for waitUntilFinished
    _queueEvents = new QueueEvents('ai-requests', { connection })
    
    console.log('AI queue initialized (BullMQ)')
    return _queue
  } catch (error) {
    console.error('Failed to initialize AI queue:', error)
    return null
  }
}

/**
 * Add a job to the AI queue (simple implementation for Upstash)
 */
async function addAIJobSimple(data: AIJobData): Promise<string> {
  const redis = getRedisClient()
  if (!redis) {
    throw new Error('Redis not available')
  }

  const jobId = `job:${Date.now()}:${Math.random().toString(36).substring(7)}`
  const jobKey = `ai:job:${jobId}`
  const queueKey = 'ai:queue:pending'

  const jobData = {
    id: jobId,
    data,
    status: 'pending',
    createdAt: Date.now(),
  }

  // Store job data
  await redis.setex(jobKey, 3600, JSON.stringify(jobData))
  
  // Add to pending queue
  await redis.lpush(queueKey, jobId)
  await redis.expire(queueKey, 3600)

  return jobId
}

/**
 * Add a job to the AI queue
 */
export async function addAIJob(
  data: AIJobData,
  options?: { priority?: number; delay?: number }
): Promise<{ jobId: string; job?: Job<AIJobData, AIJobResult> } | null> {
  // Simple queue is disabled — _useSimpleQueue is always false after the Upstash fix.

  const queue = getAIQueue()
  if (!queue) {
    return null
  }

  try {
    const job = await queue.add('ai-request', data, {
      priority: options?.priority || 0,
      delay: options?.delay || 0,
    })
    return { jobId: job.id!, job }
  } catch (error) {
    console.error('Failed to add AI job to queue:', error)
    return null
  }
}

/**
 * Get job status (simple implementation for Upstash)
 */
async function getJobStatusSimple(jobId: string): Promise<{
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress?: number
  result?: AIJobResult
  error?: string
} | null> {
  const redis = getRedisClient()
  if (!redis) {
    return null
  }

  const jobKey = `ai:job:${jobId}`
  const data = await redis.get(jobKey)
  if (!data) {
    return null
  }

  const job = JSON.parse(data)
  return {
    state: job.status as 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    result: job.result,
    error: job.error,
  }
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<{
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress?: number
  result?: AIJobResult
  error?: string
} | null> {
  if (_useSimpleQueue) {
    return getJobStatusSimple(jobId)
  }

  const queue = getAIQueue()
  if (!queue) {
    return null
  }

  try {
    const job = await queue.getJob(jobId)
    if (!job) {
      return null
    }

    const state = await job.getState()
    const progress = job.progress as number | undefined
    const result = job.returnvalue as AIJobResult | undefined
    const failedReason = job.failedReason

    return {
      state: state as 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
      progress,
      result,
      error: failedReason,
    }
  } catch (error) {
    console.error('Failed to get job status:', error)
    return null
  }
}

/**
 * Wait for job completion (with timeout)
 */
export async function waitForJob(
  jobId: string,
  timeoutMs: number = 30000
): Promise<AIJobResult | null> {
  if (_useSimpleQueue) {
    // Poll for job completion
    const startTime = Date.now()
    while (Date.now() - startTime < timeoutMs) {
      const status = await getJobStatusSimple(jobId)
      if (status?.state === 'completed' && status.result) {
        return status.result
      }
      if (status?.state === 'failed') {
        throw new Error(status.error || 'Job failed')
      }
      await new Promise(resolve => setTimeout(resolve, 500)) // Poll every 500ms
    }
    throw new Error('Job timeout')
  }

  const queue = getAIQueue()
  if (!queue || !_queueEvents) {
    return null
  }

  try {
    const job = await queue.getJob(jobId)
    if (!job) {
      return null
    }

    // Use Promise.race to implement timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Job timeout')), timeoutMs)
    })

    const result = await Promise.race([
      job.waitUntilFinished(_queueEvents),
      timeoutPromise,
    ])
    
    return result as AIJobResult
  } catch (error) {
    console.error('Failed to wait for job:', error)
    return null
  }
}

/**
 * Check if queue is available.
 * Returns false when using Upstash (queue requires a persistent worker process).
 */
export function isQueueAvailable(): boolean {
  // _useSimpleQueue was the broken Upstash pseudo-queue — it's now always false.
  // Only real BullMQ-backed queues count as "available".
  return getAIQueue() !== null
}
