import { NextRequest, NextResponse } from 'next/server'
import { getJobStatus } from '../../../../../lib/ai-queue'
import { enforceGuards } from '../../../../../lib/guards'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const guard = await enforceGuards(req)
    if (!guard.ok) return guard.res

    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { code: 'missing_job_id', message: 'Job ID required' },
        { status: 400 }
      )
    }

    const status = await getJobStatus(jobId)

    if (!status) {
      return NextResponse.json(
        { code: 'job_not_found', message: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      jobId,
      state: status.state,
      progress: status.progress,
      result: status.result,
      error: status.error,
    })
  } catch (error) {
    console.error('Job status check error:', error)
    return NextResponse.json(
      {
        code: 'status_check_failed',
        message: 'Failed to check job status',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}

