'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  creditsRemaining: number
  isAdmin: boolean
  createdAt: string
  usageCount: number
  totalCreditsPurchased: number
  totalRevenue: number
}

interface Stats {
  overview: {
    totalUsers: number
    adminUsers: number
    newUsers: number
    activeUsers: number
    totalCreditsRemaining: number
  }
  usage: {
    total: number
    period: number
    totalTokens: number
    periodTokens: number
  }
  revenue: {
    totalCreditsPurchased: number
    periodCreditsPurchased: number
    totalRevenue: number
    periodRevenue: number
  }
  dailyUsage: Array<{
    date: string
    count: number
    tokens: number
  }>
}

interface Config {
  rate: { ipPerMin: number; sessionPerMin: number }
  invites: string[]
  openaiKey?: string
  pauseTailor?: boolean
  pauseExport?: boolean
}

interface AnalyticsOverview {
  dau: number
  wau: number
  mau: number
  totalTailoringRuns: number
  avgAtsImprovement: number
  revenue: number
  conversionRate: number
}

interface FunnelData {
  event: string
  count: number
  dropoff: number
}

interface TailoringQuality {
  totalRuns: number
  positiveImprovementRate: number
  avgAtsDelta: number
  avgHonestyFlags: number
  avgTimeToComplete: number
  industryBreakdown: Array<{
    industry: string | null
    avgDelta: number
    count: number
  }>
}

interface UniversityData {
  domain: string
  name: string | null
  userCount: number
  totalRuns: number
  creditsConsumed: number
  conversionToPaid: number | null
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'config' | 'analytics'>('overview')
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [cfg, setCfg] = useState<Config | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editCredits, setEditCredits] = useState('')
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null)
  const [funnelData, setFunnelData] = useState<FunnelData[]>([])
  const [tailoringQuality, setTailoringQuality] = useState<TailoringQuality | null>(null)
  const [universityData, setUniversityData] = useState<UniversityData[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats?days=30')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/admin/config')
      if (res.ok) {
        const data = await res.json()
        setCfg(data)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  const loadData = useCallback(async () => {
    if (activeTab === 'overview') {
      try {
        const res = await fetch('/api/admin/stats?days=30')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to load stats:', error)
      }
    } else if (activeTab === 'users') {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/users?page=${page}&limit=50`)
        if (res.ok) {
          const data = await res.json()
          setUsers(data.users)
          setTotalPages(data.pagination.totalPages)
        }
      } catch (error) {
        console.error('Failed to load users:', error)
      } finally {
        setLoading(false)
      }
    } else if (activeTab === 'config') {
      try {
        const res = await fetch('/api/admin/config')
        if (res.ok) {
          const data = await res.json()
          setCfg(data)
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    } else if (activeTab === 'analytics') {
      setAnalyticsLoading(true)
      try {
        const [overviewRes, funnelRes, qualityRes, universitiesRes] = await Promise.all([
          fetch('/api/admin/analytics?endpoint=overview&days=30'),
          fetch('/api/admin/analytics?endpoint=funnel&days=30'),
          fetch('/api/admin/analytics?endpoint=tailoring-quality'),
          fetch('/api/admin/analytics?endpoint=universities'),
        ])

        if (overviewRes.ok) {
          const data = await overviewRes.json()
          setAnalyticsOverview(data)
        }
        if (funnelRes.ok) {
          const data = await funnelRes.json()
          setFunnelData(data.funnel || [])
        }
        if (qualityRes.ok) {
          const data = await qualityRes.json()
          setTailoringQuality(data)
        }
        if (universitiesRes.ok) {
          const data = await universitiesRes.json()
          setUniversityData(data.universities || [])
        }
      } catch (error) {
        console.error('Failed to load analytics:', error)
      } finally {
        setAnalyticsLoading(false)
      }
    }
  }, [activeTab, page])

  const checkAdminStatus = useCallback(async () => {
    // Check if user is admin from session
    if (status === 'authenticated' && session?.user?.isAdmin) {
      setAuthed(true)
    } else if (status === 'authenticated') {
      // User is logged in but not admin - verify with API
      try {
        const res = await fetch('/api/admin/config')
        if (res.ok) {
          setAuthed(true)
        } else {
          // Not admin
          setAuthed(false)
        }
      } catch (error) {
        // Not admin or not authenticated
        setAuthed(false)
      }
    } else {
      setAuthed(false)
    }
  }, [status, session])

  // Check if user is admin via session
  useEffect(() => {
    checkAdminStatus()
  }, [checkAdminStatus])

  // Load data when authenticated and tab/page changes
  useEffect(() => {
    if (authed) {
      loadData()
    }
  }, [activeTab, page, authed]) // Removed loadData from deps to prevent loops

  async function saveConfig() {
    if (!cfg) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      if (res.ok) {
        alert('Config saved successfully')
      } else {
        alert('Failed to save config')
      }
    } catch (error) {
      alert('Failed to save config')
    } finally {
      setLoading(false)
    }
  }

  async function updateUser(userId: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          creditsRemaining: editCredits ? parseInt(editCredits) : undefined,
          isAdmin: editIsAdmin,
        }),
      })
      if (res.ok) {
        setEditingUser(null)
        setEditCredits('')
        setEditIsAdmin(false)
        await loadUsers()
        alert('User updated successfully')
      } else {
        const data = await res.json()
        alert(data.message || 'Failed to update user')
      }
    } catch (error) {
      alert('Failed to update user')
    } finally {
      setLoading(false)
    }
  }


  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600"></div>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">Admin Access Required</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            {status === 'authenticated' 
              ? 'Your account does not have admin privileges. Please contact an administrator to grant you access.'
              : 'You must be signed in with an admin account to access this page.'}
          </p>
          {status !== 'authenticated' && (
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              onClick={() => router.push('/')}
            >
              Go to Home
            </button>
          )}
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
            <button
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              onClick={() => setActiveTab('users')}
            >
              Users
            </button>
            <button
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'config'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              onClick={() => setActiveTab('config')}
            >
              Configuration
            </button>
            <button
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'analytics'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
            <button
              className="px-4 py-2 font-medium border-b-2 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              onClick={() => router.push('/admin/runs')}
            >
              Runs
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Users</div>
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.overview.totalUsers}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  {stats.overview.newUsers} new in last 30 days
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Active Users</div>
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.overview.activeUsers}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">Last 30 days</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Usage</div>
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.usage.total.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  {stats.usage.period} in last 30 days
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Revenue</div>
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  ${stats.revenue.totalRevenue.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  ${stats.revenue.periodRevenue.toFixed(2)} in last 30 days
                </div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Credits Purchased</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.revenue.totalCreditsPurchased.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  {stats.revenue.periodCreditsPurchased.toLocaleString()} in last 30 days
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Tokens Used</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.usage.totalTokens.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  {stats.usage.periodTokens.toLocaleString()} in last 30 days
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Remaining Credits</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.overview.totalCreditsRemaining.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">Across all users</div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {loading && users.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                <div className="text-sm text-slate-500 dark:text-slate-400">Loading users...</div>
              </div>
            ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Admin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Usage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {user.email}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {user.creditsRemaining.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.isAdmin ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Admin
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              User
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {user.usageCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          ${user.totalRevenue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={() => {
                              setEditingUser(user)
                              setEditCredits(user.creditsRemaining.toString())
                              setEditIsAdmin(user.isAdmin)
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <button
                    className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600"></div>
              </div>
            ) : (
              <>
                {/* Overview Section */}
                {analyticsOverview && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Daily Active Users</div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        {analyticsOverview.dau}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Weekly Active Users</div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        {analyticsOverview.wau}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Monthly Active Users</div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        {analyticsOverview.mau}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Tailoring Runs</div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        {analyticsOverview.totalTailoringRuns.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Avg ATS Improvement</div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        {(analyticsOverview.avgAtsImprovement * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Revenue (30 days)</div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        ${analyticsOverview.revenue.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Conversion Rate</div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        {(analyticsOverview.conversionRate * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* Funnel View */}
                {funnelData.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Funnel Analysis</h2>
                    <div className="space-y-3">
                      {funnelData.map((step, index) => (
                        <div key={step.event} className="flex items-center gap-4">
                          <div className="w-32 text-sm font-medium text-slate-700 dark:text-slate-300">
                            {step.event.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="h-8 bg-blue-600 rounded"
                                style={{
                                  width: `${Math.min(100, (step.count / (funnelData[0]?.count || 1)) * 100)}%`,
                                }}
                              />
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {step.count.toLocaleString()}
                              </span>
                            </div>
                            {index > 0 && step.dropoff > 0 && (
                              <div className="text-xs text-red-600 dark:text-red-400">
                                {step.dropoff.toFixed(1)}% drop-off
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tailoring Quality */}
                {tailoringQuality && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Tailoring Quality</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Positive Improvement Rate</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {tailoringQuality.positiveImprovementRate.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Avg ATS Delta</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {(tailoringQuality.avgAtsDelta * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Avg Honesty Flags</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {tailoringQuality.avgHonestyFlags.toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Avg Time to Complete</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {Math.round(tailoringQuality.avgTimeToComplete)}s
                        </div>
                      </div>
                    </div>
                    {tailoringQuality.industryBreakdown.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">By Industry</h3>
                        <div className="space-y-2">
                          {tailoringQuality.industryBreakdown.map((industry) => (
                            <div
                              key={industry.industry}
                              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700"
                            >
                              <div>
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {industry.industry || 'Unknown'}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {industry.count} runs
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {(industry.avgDelta * 100).toFixed(1)}%
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">avg improvement</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* University View */}
                {universityData.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">University Metrics</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              University
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Users
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Runs
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Credits
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Conversion
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {universityData.map((uni) => (
                            <tr key={uni.domain} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {uni.name || uni.domain}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{uni.domain}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                                {uni.userCount}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                                {uni.totalRuns}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                                {uni.creditsConsumed}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                                {uni.conversionToPaid ? `${(uni.conversionToPaid * 100).toFixed(1)}%` : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Config Tab */}
        {activeTab === 'config' && cfg && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">System Configuration</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      IP Rate Limit (per minute)
                    </label>
                    <input
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      type="number"
                      value={cfg.rate.ipPerMin}
                      onChange={(e) =>
                        setCfg({ ...cfg, rate: { ...cfg.rate, ipPerMin: Number(e.target.value) } })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Session Rate Limit (per minute)
                    </label>
                    <input
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      type="number"
                      value={cfg.rate.sessionPerMin}
                      onChange={(e) =>
                        setCfg({ ...cfg, rate: { ...cfg.rate, sessionPerMin: Number(e.target.value) } })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Invite Codes (comma-separated)
                  </label>
                  <input
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    value={(cfg.invites || []).join(', ')}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        invites: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Override OpenAI API Key
                  </label>
                  <input
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    type="password"
                    placeholder="sk-..."
                    value={cfg.openaiKey || ''}
                    onChange={(e) => setCfg({ ...cfg, openaiKey: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!cfg.pauseTailor}
                      onChange={(e) => setCfg({ ...cfg, pauseTailor: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Pause Tailoring</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!cfg.pauseExport}
                      onChange={(e) => setCfg({ ...cfg, pauseExport: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Pause Export</span>
                  </label>
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                    onClick={saveConfig}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Configuration'}
                  </button>
                  <button
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                    onClick={loadConfig}
                  >
                    Reload
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
                Edit User: {editingUser.email}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Credits Remaining
                  </label>
                  <input
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    type="number"
                    value={editCredits}
                    onChange={(e) => setEditCredits(e.target.value)}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsAdmin}
                      onChange={(e) => setEditIsAdmin(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Admin Privileges</span>
                  </label>
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                    onClick={() => updateUser(editingUser.id)}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                    onClick={() => {
                      setEditingUser(null)
                      setEditCredits('')
                      setEditIsAdmin(false)
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
