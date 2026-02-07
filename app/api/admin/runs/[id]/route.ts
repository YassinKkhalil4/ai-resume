import { NextRequest, NextResponse } from 'next/server'
import { db, tailorRuns, tailorRunEvents, tailorDebugSnapshots, users } from '../../../../../lib/db'
import { eq, desc } from 'drizzle-orm'
import { getCurrentUser, isUserAdmin } from '../../../../../lib/auth/utils'

async function checkAdmin(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, res: NextResponse.json({ code: 'unauthorized', message: 'Not authenticated' }, { status: 401 }) }
  }
  // Use cached user data instead of making another query
  if (!user.isAdmin) {
    return { ok: false, res: NextResponse.json({ code: 'forbidden', message: 'Admin access required' }, { status: 403 }) }
  }
  return { ok: true }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/runs/[id] - Get full run details with timeline
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestStart = Date.now()
  const { id: runId } = await params
  const adminCheckStart = Date.now()
  const adminCheck = await checkAdmin(req)
  if (!adminCheck.ok) return adminCheck.res

  try {

    // Get run details
    const runQueryStart = Date.now()
    const [run] = await db
      .select({
        id: tailorRuns.id,
        userId: tailorRuns.userId,
        userEmail: users.email,
        sessionId: tailorRuns.sessionId,
        createdAt: tailorRuns.createdAt,
        completedAt: tailorRuns.completedAt,
        status: tailorRuns.status,
        modelUsed: tailorRuns.modelUsed,
        tokensIn: tailorRuns.tokensIn,
        tokensOut: tailorRuns.tokensOut,
        latencyMs: tailorRuns.latencyMs,
        creditsUsed: tailorRuns.creditsUsed,
        featureFlags: tailorRuns.featureFlags,
        finalAtsBefore: tailorRuns.finalAtsBefore,
        finalAtsAfter: tailorRuns.finalAtsAfter,
      })
      .from(tailorRuns)
      .leftJoin(users, eq(tailorRuns.userId, users.id))
      .where(eq(tailorRuns.id, runId))
      .limit(1)

    if (!run) {
      return NextResponse.json(
        { code: 'not_found', message: 'Run not found' },
        { status: 404 }
      )
    }

    // Get all events ordered by timestamp
    const eventsQueryStart = Date.now()
    const events = await db
      .select()
      .from(tailorRunEvents)
      .where(eq(tailorRunEvents.runId, runId))
      .orderBy(desc(tailorRunEvents.timestamp))

    // Group events by stage
    const groupingStart = Date.now()
    const eventsByStage: Record<string, typeof events> = {}
    for (const event of events) {
      if (!eventsByStage[event.stage]) {
        eventsByStage[event.stage] = []
      }
      eventsByStage[event.stage].push(event)
    }

    // Get snapshot metadata (if available)
    const snapshotsQueryStart = Date.now()
    const snapshots = await db
      .select({
        id: tailorDebugSnapshots.id,
        snapshotType: tailorDebugSnapshots.snapshotType,
        createdAt: tailorDebugSnapshots.createdAt,
        expiresAt: tailorDebugSnapshots.expiresAt,
      })
      .from(tailorDebugSnapshots)
      .where(eq(tailorDebugSnapshots.runId, runId))

    // Build timeline with stage status
    const allStages = [
      'resume_parse',
      'jd_analysis',
      'keyword_engine',
      'keyword_decisions',
      'prompt_build',
      'model_call',
      'resume_diff',
      'ats_scoring',
      'honesty_check',
      'presentation_guard',
    ]

    const timeline = allStages.map(stage => {
      const stageEvents = eventsByStage[stage] || []
      const hasError = stageEvents.some(e => e.eventType === 'error')
      const hasEvents = stageEvents.length > 0

      return {
        stage,
        status: hasError ? 'failed' : hasEvents ? 'success' : 'pending',
        eventCount: stageEvents.length,
        events: stageEvents.map(e => ({
          id: e.id,
          timestamp: e.timestamp,
          eventType: e.eventType,
          payload: e.payload,
        })),
      }
    })
    const totalDuration = Date.now() - requestStart

    return NextResponse.json({
      run: {
        id: run.id,
        userId: run.userId,
        userEmail: run.userEmail,
        sessionId: run.sessionId,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        status: run.status,
        modelUsed: run.modelUsed,
        tokensIn: run.tokensIn,
        tokensOut: run.tokensOut,
        latencyMs: run.latencyMs,
        creditsUsed: run.creditsUsed,
        featureFlags: run.featureFlags,
        finalAtsBefore: run.finalAtsBefore,
        finalAtsAfter: run.finalAtsAfter,
        atsDelta: (run.finalAtsAfter || 0) - (run.finalAtsBefore || 0),
      },
      timeline,
      snapshots: snapshots.map(s => ({
        id: s.id,
        snapshotType: s.snapshotType,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching run details:', error)
    return NextResponse.json(
      { code: 'server_error', message: 'Failed to fetch run details' },
      { status: 500 }
    )
  }
}

