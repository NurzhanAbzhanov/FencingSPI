import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { loadPollResults, loadIndividualBallots } from '../../lib/pollRepository'
import TeamLogo from '../../components/polls/TeamLogo'
import { createPollResultsCsv, downloadCsv } from '../../lib/pollCsv'

type Poll = {
  id: string
  label: string
  status: string
  opens_at: string | null
  closes_at: string | null
}

type Standing = {
  rank: number
  teamId: number
  teamName: string
  points: number
  firstPlaceVotes: number
}

type DetailedCategory = {
  categorySlug: string
  definitionId: string
  label: string
  slotCount: number
  standings: Standing[]
  ballots: {
    ballotId: string
    voterName: string
    voterEmail?: string
    rankings: { rank: number; teamId: number; teamName: string }[]
  }[]
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All Categories' },
  { id: 'overall', label: 'Overall Teams' },
  { id: 'diii', label: 'Division III' },
  { id: 'mens_squads', label: "Men's Squads" },
  { id: 'womens_squads', label: "Women's Squads" },
]

export default function PollResultsPage({ periodId: propPeriodId }: { periodId?: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [polls, setPolls] = useState<Poll[]>([])
  const [selectedPollId, setSelectedPollId] = useState<string>(propPeriodId || '')
  const [categoriesData, setCategoriesData] = useState<DetailedCategory[]>([])
  const [standingsLoading, setStandingsLoading] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<string>('all')

  useEffect(() => {
    async function loadPolls() {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data: pollRows } = await supabase
        .from('poll_periods')
        .select('id, label, status, opens_at, closes_at')
        .order('opens_at', { ascending: false })

      const pollList = (pollRows ?? []) as Poll[]
      const sorted = [...pollList].sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1
        if (b.status === 'open' && a.status !== 'open') return 1
        return 0
      })
      setPolls(sorted)

      const defaultPollId = propPeriodId || (sorted.find((p) => p.status === 'open') ?? sorted[0])?.id || 'period-1'
      setSelectedPollId(defaultPollId)
      setLoading(false)
    }
    loadPolls()
  }, [propPeriodId])

  useEffect(() => {
    const targetId = selectedPollId || propPeriodId || 'period-1'

    async function loadStandings() {
      setStandingsLoading(true)
      setError('')

      try {
        const catResults = await loadPollResults(targetId)

        const detailed: DetailedCategory[] = await Promise.all(
          catResults.map(async (cr) => {
            let individualBallots: any[] = []
            try {
              individualBallots = await loadIndividualBallots(cr.definitionId, targetId)
            } catch {}

            return {
              categorySlug: cr.category.slug,
              definitionId: cr.definitionId,
              label: cr.category.label,
              slotCount: cr.category.rankLimit || 15,
              standings: cr.standings.map((s) => ({
                rank: s.rank,
                teamId: s.teamId,
                teamName: s.teamName,
                points: s.points,
                firstPlaceVotes: s.firstPlaceVotes,
              })),
              ballots: individualBallots,
            }
          })
        )

        setCategoriesData(detailed)
      } catch (err: any) {
        setError(err.message || 'Failed to load poll results.')
      } finally {
        setStandingsLoading(false)
      }
    }

    loadStandings()
  }, [selectedPollId, propPeriodId])

  const handleExportCsv = () => {
    if (!categoriesData.length) return
    const activePollLabel = polls.find((p) => p.id === selectedPollId)?.label || 'Poll Results'
    const csvContent = createPollResultsCsv(categoriesData.flatMap((r) => r.standings))
    const filename = `${activePollLabel.toLowerCase().replace(/\s+/g, '-')}-results.csv`
    downloadCsv(filename, csvContent)
  }

  const filteredCategories = categoriesData.filter((cat) => {
    if (activeTab === 'all') return true
    if (activeTab === 'overall') return cat.categorySlug.endsWith('_team_overall')
    if (activeTab === 'diii') return cat.categorySlug.includes('_diii')
    if (activeTab === 'mens_squads') return cat.categorySlug.startsWith('men_squad_')
    if (activeTab === 'womens_squads') return cat.categorySlug.startsWith('women_squad_')
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading poll results…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8">
      <div className="max-w-5xl mx-auto px-6">
        {/* Top Header Row */}
        <div className="flex items-center justify-between mb-2">
          <a
            href="#/polls"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1.5"
          >
            ← Dashboard
          </a>

          <div className="flex items-center gap-3">
            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={categoriesData.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>

            {/* Poll Round Select Dropdown */}
            {polls.length > 0 && (
              <select
                value={selectedPollId}
                onChange={(e) => setSelectedPollId(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
              >
                {polls.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} {p.status === 'open' ? '(Open)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Large Page Title */}
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-5">Poll Results</h1>

        

        {/* Category Pill Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#047857] text-white shadow-2xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Standings by category */}
        {standingsLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-2xs">
            <p className="text-xs text-gray-400">Loading standings…</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredCategories.map((cat) => {
              const catStandings = cat.standings ?? []
              const ballots = cat.ballots ?? []
              const ballotCount = ballots.length
              const isExpanded = expandedCategories[cat.categorySlug] ?? false

              return (
                <div
                  key={cat.categorySlug}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs"
                >
                  {/* Card header */}
                  <div className="px-5 py-4 bg-gray-50/50 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">{cat.label}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ballotCount === 0 ? 'No ballots yet' : `${ballotCount} ballot${ballotCount === 1 ? '' : 's'} submitted`}
                      </p>
                    </div>

                    {ballots.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCategories((prev) => ({
                            ...prev,
                            [cat.categorySlug]: !prev[cat.categorySlug],
                          }))
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 hover:bg-emerald-100 transition-colors"
                      >
                        <svg
                          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {isExpanded ? 'Hide ballots' : `View individual ballots (${ballots.length})`}
                      </button>
                    )}
                  </div>

                  {catStandings.length === 0 ? (
                    <p className="px-5 py-4 text-xs text-gray-400">No votes recorded yet.</p>
                  ) : (
                    <div>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-12">Rank</th>
                            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Team</th>
                            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-24">Points</th>
                            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-32">1st-Place Votes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {catStandings.map((row) => (
                            <tr key={row.teamId} className="hover:bg-gray-50/75 transition-colors">
                              <td className="px-4 py-2.5 text-sm font-medium text-gray-400 tabular-nums">{row.rank}</td>
                              <td className="px-4 py-2.5 text-sm text-gray-900 flex items-center gap-2">
                                <TeamLogo name={row.teamName} size={20} />
                                <span className="font-semibold">{row.teamName}</span>
                              </td>
                              <td className="px-4 py-2.5 text-sm font-medium text-gray-900 tabular-nums">{row.points}</td>
                              <td className="px-4 py-2.5 text-sm text-gray-500 tabular-nums">
                                {row.firstPlaceVotes > 0 ? (
                                  <span className="font-semibold text-emerald-700">{row.firstPlaceVotes}</span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Individual Coach Ballots Breakdown (Comparison Matrix Table) */}
                      {isExpanded && ballots.length > 0 && (
                        <div className="border-t border-gray-200 bg-gray-50/50 p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Coach Ballots — {cat.label}
                            </h3>
                            <span className="text-xs text-gray-400">
                              Scroll horizontally to view all coaches
                            </span>
                          </div>

                          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-2xs">
                            <table className="w-full border-collapse text-left text-xs">
                              <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                  <th className="px-2 py-1.5 font-semibold text-gray-600 border-r border-gray-200 w-12 sticky left-0 bg-gray-100 z-20 text-center">
                                    Rank
                                  </th>
                                  {ballots.map((b, bIdx) => (
                                    <th
                                      key={bIdx}
                                      className="px-2 py-1.5 font-semibold text-gray-900 border-r border-gray-200 w-28 max-w-[120px]"
                                      title={b.voterName + (b.voterEmail ? ` (${b.voterEmail})` : '')}
                                    >
                                      <div className="truncate">{b.voterName}</div>
                                      {b.voterEmail && (
                                        <div className="text-[10px] font-normal text-gray-400 truncate">
                                          {b.voterEmail}
                                        </div>
                                      )}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {Array.from({ length: cat.slotCount }).map((_, rankIdx) => (
                                  <tr key={rankIdx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-2 py-1.5 font-semibold text-gray-400 tabular-nums border-r border-gray-200 sticky left-0 bg-white z-10 text-center">
                                      #{rankIdx + 1}
                                    </td>
                                    {ballots.map((b, bIdx) => {
                                      const rankingPick = b.rankings.find((r: any) => r.rank === rankIdx + 1)
                                      const teamName = rankingPick?.teamName
                                      return (
                                        <td
                                          key={bIdx}
                                          className="px-2 py-1.5 text-gray-800 border-r border-gray-100 w-28 max-w-[120px] truncate"
                                          title={teamName ?? ''}
                                        >
                                          {teamName ? (
                                            <span className="font-medium truncate block">{teamName}</span>
                                          ) : (
                                            <span className="text-gray-300 italic">—</span>
                                          )}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
