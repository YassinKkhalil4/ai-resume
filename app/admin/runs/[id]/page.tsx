'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Run {
  id: string
  userId: string
  userEmail: string | null
  sessionId: string | null
  createdAt: string
  completedAt: string | null
  status: 'success' | 'failed' | 'partial'
  modelUsed: string | null
  tokensIn: number | null
  tokensOut: number | null
  latencyMs: number | null
  creditsUsed: number | null
  finalAtsBefore: number | null
  finalAtsAfter: number | null
  atsDelta: number
}

interface TimelineStage {
  stage: string
  status: 'success' | 'failed' | 'pending'
  eventCount: number
  events: Array<{
    id: string
    timestamp: string
    eventType: string
    payload: any
  }>
}

const STAGE_LABELS: Record<string, string> = {
  resume_parse: 'Resume Parsed',
  jd_analysis: 'JD Analyzed',
  keyword_engine: 'Keywords Extracted',
  keyword_decisions: 'Keyword Decisions',
  prompt_build: 'Prompt Built',
  model_call: 'Model Called',
  resume_diff: 'Resume Diff',
  ats_scoring: 'ATS Scored',
  honesty_check: 'Honesty Checked',
  presentation_guard: 'Presentation Guard',
}

export default function RunDetailPage() {
  const params = useParams()
  const router = useRouter()
  const runId = params.id as string
  const [run, setRun] = useState<Run | null>(null)
  const [timeline, setTimeline] = useState<TimelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadRunDetails()
  }, [runId])

  async function loadRunDetails() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/runs/${runId}`)
      if (res.ok) {
        const data = await res.json()
        setRun(data.run)
        setTimeline(data.timeline)
      }
    } catch (error) {
      console.error('Failed to load run details:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleStage = (stage: string) => {
    const newExpanded = new Set(expandedStages)
    if (newExpanded.has(stage)) {
      newExpanded.delete(stage)
    } else {
      newExpanded.add(stage)
    }
    setExpandedStages(newExpanded)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅'
      case 'failed':
        return '❌'
      case 'pending':
        return '⏳'
      default:
        return '⚠️'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600"></div>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Run Not Found</h1>
          <Link href="/admin/runs" className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
            Back to Runs
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Admin Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage users, view statistics, and configure system settings
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-4">
            <Link
              href="/admin"
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Overview
            </Link>
            <Link
              href="/admin"
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Users
            </Link>
            <Link
              href="/admin"
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Configuration
            </Link>
            <Link
              href="/admin"
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Analytics
            </Link>
            <Link
              href="/admin/runs"
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                'border-blue-600 text-blue-600 dark:text-blue-400'
              }`}
            >
              Runs
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Run Details</h2>
              <p className="text-slate-600 dark:text-slate-400 font-mono text-sm">{run.id}</p>
            </div>
            <Link
              href="/admin/runs"
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              Back to Runs
            </Link>
          </div>
        </div>

        {/* Run Summary */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Run Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">User</div>
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100">{run.userEmail || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Status</div>
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100">{run.status}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">ATS Delta</div>
              <div className={`text-lg font-medium ${run.atsDelta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {run.atsDelta >= 0 ? '+' : ''}{run.atsDelta}%
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">ATS Before</div>
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100">{run.finalAtsBefore !== null ? `${run.finalAtsBefore}%` : 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">ATS After</div>
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100">{run.finalAtsAfter !== null ? `${run.finalAtsAfter}%` : 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Created</div>
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100">{new Date(run.createdAt).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Pipeline Timeline</h2>
          <div className="space-y-4">
            {timeline.map((stage, index) => (
              <div key={stage.stage} className="border-l-2 border-slate-200 dark:border-slate-700 pl-4 relative">
                <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600"></div>
                <button
                  onClick={() => toggleStage(stage.stage)}
                  className="w-full text-left flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getStatusIcon(stage.status)}</span>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {STAGE_LABELS[stage.stage] || stage.stage}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {stage.eventCount} event{stage.eventCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-400">
                    {expandedStages.has(stage.stage) ? '▼' : '▶'}
                  </span>
                </button>
                {expandedStages.has(stage.stage) && stage.events.length > 0 && (
                  <div className="ml-8 mt-2 space-y-2">
                    {stage.events.map((event) => (
                      <div
                        key={event.id}
                        className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 border border-slate-200 dark:border-slate-600"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {event.eventType}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <pre className="text-xs bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-600 overflow-x-auto">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

