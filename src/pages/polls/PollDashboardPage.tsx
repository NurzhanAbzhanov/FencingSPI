import { useEffect, useState } from 'react'
import { loadPollDashboard } from '../../lib/pollRepository'
import type { PollDashboard } from '../../types/polls'
import { supabase } from '../../lib/supabase'

// DIII team categories require overall to be submitted first
const DIII_PREREQUISITES: Record<string, string> = {
  men_team_diii: 'men_team_overall',
  women_team_diii: 'women_team_overall',
}

export default function PollDashboardPage({ user: _user }: { user?: any } = {}) {
  const [data, setData] = useState<PollDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    async function init() {
      try {
        let currentUserId = ''
        if (supabase) {
          const authUser = await supabase.auth.getUser()
          if (authUser?.data?.user) {
            currentUserId = authUser.data.user.id
            setUserId(currentUserId)
            const profile = await supabase
              .from('profiles')
              .select('role')
              .eq('id', currentUserId)
              .maybeSingle()
            if (profile?.data?.role === 'admin') {
              setIsAdmin(true)
            }
          }
        }
        const dashboardData = await loadPollDashboard(currentUserId)
        setData(dashboardData)
      } catch (err: any) {
        setError(err.message || 'Failed to load poll dashboard.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading poll dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md text-center shadow-sm">
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }



  const hasActivePeriod = Boolean(data && data.period)
  const period = data?.period
  const categories = data?.categories || []
  const visibleCategories = categories.filter((c: any) => !c.hidden)

  let completedCategories: Record<string, boolean> = {}
  try {
    if (typeof localStorage !== 'undefined') {
      const userKey = userId ? `user_${userId}_submitted_ballots` : 'fencing_spi_submitted_ballots'
      completedCategories = JSON.parse(localStorage.getItem(userKey) || '{}')
    }
  } catch {}

  visibleCategories.forEach((c: any) => {
    if (c.ballotStatus === 'submitted') {
      completedCategories[c.slug] = true
    }
  })

  const completedCount = visibleCategories.filter((c: any) => completedCategories[c.slug]).length
  const totalCount = visibleCategories.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            {hasActivePeriod && period ? period.label : 'Coaches Poll'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {hasActivePeriod ? 'Submit Ballots' : 'No active poll period'}
          </p>
        </div>

        {hasActivePeriod && (
          <>
            {/* Progress */}
            <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Overall progress</span>
                <span className="text-sm font-medium text-gray-900">
                  {completedCount} / {totalCount}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {completedCount === totalCount && (
                <p className="mt-2 text-sm text-green-700 font-medium">All ballots submitted ✓</p>
              )}
            </div>

            {/* Category list */}
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 mb-6">
          {visibleCategories.map((cat: any) => {
            const done = completedCategories[cat.slug]

            const prereq = DIII_PREREQUISITES[cat.slug]
            const prereqDone = prereq ? completedCategories[prereq] : true
            const isLocked = !done && !prereqDone

            if (isLocked) {
              const prereqLabel = visibleCategories.find((c: any) => c.slug === prereq)?.label || 'Overall'
              return (
                <div
                  key={cat.slug}
                  data-testid="poll-category"
                  className="flex items-center justify-between px-5 py-3.5 opacity-60 cursor-not-allowed"
                  title={`Complete ${prereqLabel} first`}
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span className="text-sm text-gray-500">{cat.label}</span>
                  </div>
                  <span className="text-xs text-gray-400">Complete {prereqLabel} first</span>
                </div>
              )
            }

            return (
              <a
                key={cat.slug}
                data-testid="poll-category"
                href={`#/polls/vote/${cat.slug}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <span className="text-sm text-gray-800 group-hover:text-gray-900">{cat.label}</span>
                {done ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✓ Submitted · Edit
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                    Not started
                  </span>
                )}
              </a>
            )
          })}
            </div>
          </>
        )}

        {/* Poll Results Link Below Ballot Categories */}
        <div className="mb-8">
          <a
            href="#/polls/results"
            className="block bg-white border border-gray-200 rounded-lg px-5 py-4 hover:border-green-600 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-green-700 transition-colors">Poll Results</p>
              </div>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        </div>

        {/* Admin Tools Section */}
        {isAdmin && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin Tools</p>
            <a
              href="#/admin/polls"
              className="block bg-white border border-gray-200 rounded-lg px-5 py-4 hover:border-green-600 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 group-hover:text-green-700 transition-colors">Manage Polls</p>
                  <p className="mt-0.5 text-sm text-gray-500">Open and close voting windows, schedule polls, view poll history</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>
            <a
              href="#/admin/participation"
              className="block bg-white border border-gray-200 rounded-lg px-5 py-4 hover:border-green-600 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 group-hover:text-green-700 transition-colors">Participation Tracker</p>
                  <p className="mt-0.5 text-sm text-gray-500">See which coaches have submitted each ballot category</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
