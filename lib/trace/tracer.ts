import { db, tailorRuns, tailorRunEvents, NewTailorRun, NewTailorRunEvent } from '../db'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Stage, isValidStage } from './stages'

export interface CreateRunOptions {
  userId: string
  sessionId?: string
  featureFlags?: Record<string, any>
}

export interface CompleteRunMetrics {
  status: 'success' | 'failed' | 'partial'
  modelUsed?: string
  tokensIn?: number
  tokensOut?: number
  latencyMs?: number
  creditsUsed?: number
  finalAtsBefore?: number
  finalAtsAfter?: number
}

/**
 * Creates a new tailor run record
 * Returns the run ID, or null if creation fails (non-blocking)
 */
export async function createTailorRun(options: CreateRunOptions): Promise<string | null> {
  try {
    const runId = uuid()
    const run: NewTailorRun = {
      id: runId,
      userId: options.userId,
      sessionId: options.sessionId || null,
      featureFlags: options.featureFlags || null,
      status: 'success', // Will be updated on completion
    }

    await db.insert(tailorRuns).values(run)
    return runId
  } catch (error) {
    console.error('Failed to create tailor run:', error)
    return null
  }
}

/**
 * Logs a structured event for a tailor run
 * Non-blocking - failures are logged but don't throw
 */
export async function logEvent(
  runId: string | null,
  stage: Stage,
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  if (!runId) {
    return // Silently skip if no run ID
  }

  try {
    // Validate stage
    if (!isValidStage(stage)) {
      console.warn(`Invalid stage: ${stage}`)
      return
    }

    // Ensure payload is a plain object (not null, not array at root)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      console.warn(`Invalid payload for stage ${stage}: must be a plain object`)
      return
    }

    const event: NewTailorRunEvent = {
      id: uuid(),
      runId,
      stage,
      eventType,
      payload,
    }

    await db.insert(tailorRunEvents).values(event)
  } catch (error) {
    console.error(`Failed to log event for stage ${stage}:`, error)
    // Don't throw - tracing failures should never break the pipeline
  }
}

/**
 * Logs multiple events in a single batch operation
 * Much more efficient than calling logEvent multiple times
 * Non-blocking - failures are logged but don't throw
 */
export async function logEventsBatch(
  runId: string | null,
  events: Array<{ stage: Stage; eventType: string; payload: Record<string, any> }>
): Promise<void> {
  if (!runId || events.length === 0) {
    return
  }

  try {
    const validEvents: NewTailorRunEvent[] = []

    for (const { stage, eventType, payload } of events) {
      // Validate stage
      if (!isValidStage(stage)) {
        console.warn(`Invalid stage: ${stage}`)
        continue
      }

      // Ensure payload is a plain object
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        console.warn(`Invalid payload for stage ${stage}: must be a plain object`)
        continue
      }

      validEvents.push({
        id: uuid(),
        runId,
        stage,
        eventType,
        payload,
      })
    }

    if (validEvents.length > 0) {
      await db.insert(tailorRunEvents).values(validEvents)
    }
  } catch (error) {
    console.error('Failed to log events batch:', error)
    // Don't throw - tracing failures should never break the pipeline
  }
}

/**
 * Marks a run as completed with final metrics
 * Non-blocking - failures are logged but don't throw
 */
export async function completeRun(runId: string | null, metrics: CompleteRunMetrics): Promise<void> {
  if (!runId) {
    return
  }

  try {
    await db
      .update(tailorRuns)
      .set({
        completedAt: new Date(),
        status: metrics.status,
        modelUsed: metrics.modelUsed || null,
        tokensIn: metrics.tokensIn || null,
        tokensOut: metrics.tokensOut || null,
        latencyMs: metrics.latencyMs || null,
        creditsUsed: metrics.creditsUsed || null,
        finalAtsBefore: metrics.finalAtsBefore || null,
        finalAtsAfter: metrics.finalAtsAfter || null,
      })
      .where(eq(tailorRuns.id, runId))
  } catch (error) {
    console.error('Failed to complete tailor run:', error)
    // Don't throw - tracing failures should never break the pipeline
  }
}

/**
 * Marks a run as failed with error context
 * Non-blocking - failures are logged but don't throw
 */
export async function failRun(runId: string | null, stage: Stage, error: Error | string): Promise<void> {
  if (!runId) {
    return
  }

  try {
    const errorMessage = error instanceof Error ? error.message : error
    const errorStack = error instanceof Error ? error.stack : undefined

    // Log the failure as an event
    await logEvent(runId, stage, 'error', {
      error_message: errorMessage,
      error_stack: errorStack,
      failed_at: new Date().toISOString(),
    })

    // Update run status
    await db
      .update(tailorRuns)
      .set({
        completedAt: new Date(),
        status: 'failed',
      })
      .where(eq(tailorRuns.id, runId))
  } catch (err) {
    console.error('Failed to mark run as failed:', err)
    // Don't throw - tracing failures should never break the pipeline
  }
}

