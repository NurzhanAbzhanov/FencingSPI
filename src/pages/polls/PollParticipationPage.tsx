import { useEffect, useState } from 'react'
import { loadParticipation, loadPollPeriods } from '../../lib/pollAdminRepository'
import { CATEGORIES } from '../../lib/pollStandings'
import type { PollParticipationRow, PollPeriodAdmin } from '../../types/polls'

const TOTAL_CATEGORIES = CATEGORIES.filter((c) => !c.hidden).length

export default function PollParticipationPage({ periodId, season = '2025-26' }: { periodId?: string; season?: string }) {
  const [periods, setPeriods] = useState<PollPeriodAdmin[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(periodId && periodId !== 'current' ? periodId : '')
  const [rows, setRows] = useState<PollParticipationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (periodId && periodId !== 'current') {
      setSelectedPeriodId(periodId)
    }
  }, [periodId])

  useEffect(() => {
    loadPollPeriods(season)
      .then((loaded) => {
        setPeriods(loaded)
        if ((!selectedPeriodId || selectedPeriodId === 'current') && loaded.length > 0) {
          const active = loaded.find((p) => p.status === 'open') ?? loaded[0]
          setSelectedPeriodId(active.id)
        }
      })
      .catch(() => {
        if (!selectedPeriodId || selectedPeriodId === 'current') setSelectedPeriodId('period-1')
      })
  }, [season])

  useEffect(() => {
    if (!selectedPeriodId || selectedPeriodId === 'current') return

    setLoading(true)
    loadParticipation(selectedPeriodId)
      .then((loaded) => {
        setRows(loaded)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load participation data.')
        setLoading(false)
      })
  }, [selectedPeriodId])

  const visibleCategories = CATEGORIES.filter((c) => !c.hidden)
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId)

  // Calculate stats
  const processedRows = rows.map((r) => {
    const completedSlugs = Object.entries(r.statuses)
      .filter(([_, status]) => status === 'submitted')
      .map(([slug]) => slug)
    const completedCount = completedSlugs.length
    const missingSlugs = visibleCategories
      .filter((c) => !completedSlugs.includes(c.slug))
      .map((c) => c.label)

    return {
      ...r,
      completedCount,
      missingSlugs,
    }
  })

  const allDone = processedRows.filter((r) => r.completedCount === TOTAL_CATEGORIES).length
  const inProgress = processedRows.filter((r) => r.completedCount > 0 && r.completedCount < TOTAL_CATEGORIES).length
  const notStarted = processedRows.filter((r) => r.completedCount === 0).length
  const totalBallots = processedRows.reduce((sum, r) => sum + r.completedCount, 0)
  const maxPossible = processedRows.length * TOTAL_CATEGORIES

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <a href="#/polls" className="text-xs font-medium text-green-700 hover:text-green-800">
              ← Dashboard
            </a>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 tracking-tight">Coach Participation</h1>
          </div>

          {periods.length > 0 && (
            <select
              id="poll-select"
              aria-label="Select Poll"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-900 bg-white focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 cursor-pointer shadow-2xs"
            >
              {periods.map((poll) => (
                <option key={poll.id} value={poll.id}>
                  {poll.label} {poll.status === 'open' ? '(Open)' : '(Closed)'}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-gray-500 py-8 text-center">Loading participation data…</p>
        ) : error ? (
          <div className="bg-white border border-red-200 rounded-lg p-6 text-center text-xs text-red-600">
            {error}
          </div>
        ) : (
          <>
            {/* Summary Stats Grid */}
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 mb-6">
              {[
                { label: 'Total Ballots', value: `${totalBallots} / ${maxPossible}`, sub: 'submitted' },
                { label: 'Completed', value: allDone, sub: `${allDone === 1 ? 'coach' : 'coaches'} all ${TOTAL_CATEGORIES}` },
                { label: 'In Progress', value: inProgress, sub: `${inProgress === 1 ? 'coach' : 'coaches'}` },
                { label: 'Not Started', value: notStarted, sub: `${notStarted === 1 ? 'coach' : 'coaches'}` },
              ].map((stat) => (
                <div key={stat.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3.5 shadow-2xs">
                  <p className="text-[11px] text-gray-500 mb-1 font-medium">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Per-Coach Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {selectedPeriod?.label ?? 'Current Poll'} — Per-Coach Breakdown
                </h2>
                <span className="text-[11px] text-gray-400">
                  {processedRows.length} {processedRows.length === 1 ? 'voter' : 'voters'}
                </span>
              </div>

              {processedRows.length === 0 ? (
                <p className="px-5 py-8 text-xs text-gray-400 text-center">No coaches found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Coach</th>
                        <th className="px-4 py-2 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Email</th>
                        <th className="px-4 py-2 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Progress</th>
                        <th className="px-4 py-2 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Status</th>
                        <th className="px-4 py-2 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Missing Categories</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {processedRows.map((row) => (
                        <tr key={row.voterId} className="hover:bg-gray-50/75 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{row.voterName}</td>
                          <td className="px-4 py-2.5 text-gray-500">{row.email || '—'}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${(row.completedCount / TOTAL_CATEGORIES) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-gray-500 tabular-nums whitespace-nowrap">
                                {row.completedCount}/{TOTAL_CATEGORIES}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {row.completedCount === TOTAL_CATEGORIES ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                                Submitted
                              </span>
                            ) : row.completedCount > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800">
                                In progress
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                                Not started
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-gray-500 max-w-xs">
                            {row.missingSlugs.length === 0 ? (
                              <span className="text-green-700 font-medium">All submitted ✓</span>
                            ) : (
                              <span className="truncate block" title={row.missingSlugs.join(', ')}>
                                {row.missingSlugs.join(', ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
