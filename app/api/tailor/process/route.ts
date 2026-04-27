/**
 * API route to process AI jobs from the queue
 * Used when worker is not available (e.g., Upstash or serverless)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, getRedisType } from '../../../../lib/redis'
import { processAIJobDirect } from '../../../../lib/ai-worker'
import { AIJobData } from '../../../../lib/ai-queue'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.INTERNAL_AI_PROCESSOR_SECRET
    const authHeader = req.headers.get('authorization') || ''
    const receivedSecret = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return NextResponse.json(
        { code: 'unauthorized', message: 'Internal processor authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { jobId, data } = body

    if (!jobId || !data) {
      return NextResponse.json(
        { code: 'missing_params', message: 'Job ID and data required' },
        { status: 400 }
      )
    }

    // Update job status to 'active'
    const redis = getRedisClient()
    if (redis && getRedisType() === 'upstash') {
      const jobKey = `ai:job:${jobId}`
      const jobData = await redis.get(jobKey)
      if (jobData) {
        const job = JSON.parse(jobData)
        job.status = 'active'
        await redis.setex(jobKey, 3600, JSON.stringify(job))
      }
    }

    // Process the job
    const result = await processAIJobDirect(data as AIJobData)

    // Update job status to 'completed' with result
    if (redis && getRedisType() === 'upstash') {
      const jobKey = `ai:job:${jobId}`
      const jobData = await redis.get(jobKey)
      if (jobData) {
        const job = JSON.parse(jobData)
        job.status = 'completed'
        job.result = result
        await redis.setex(jobKey, 3600, JSON.stringify(job))
      }
    }

    return NextResponse.json({
      jobId,
      status: 'completed',
      result,
    })
  } catch (error) {
    console.error('Job processing error:', error)

    // Update job status to 'failed'
    const redis = getRedisClient()
    if (redis && getRedisType() === 'upstash') {
      const { jobId } = await req.json().catch(() => ({}))
      if (jobId) {
        const jobKey = `ai:job:${jobId}`
        const jobData = await redis.get(jobKey)
        if (jobData) {
          const job = JSON.parse(jobData)
          job.status = 'failed'
          job.error = error instanceof Error ? error.message : String(error)
          await redis.setex(jobKey, 3600, JSON.stringify(job))
        }
      }
    }

    return NextResponse.json(
      {
        code: 'job_processing_failed',
        message: 'Failed to process job',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
