import { Lock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { loadPollBallot, savePollBallot } from '../../lib/pollRepository'
import { validateBallotTeamIds } from '../../lib/pollDomain'
import type { PollBallotView, PollCategorySlug } from '../../types/polls'
import type { PlatformUser } from '../../types/platform'
import TeamLogo from '../../components/polls/TeamLogo'
import TeamSelectCombobox from '../../components/polls/TeamSelectCombobox'

function getPrevSeasonLabel(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const prevStartYear = month >= 7 ? year - 1 : year - 2
  return `SPI ${prevStartYear}/${prevStartYear + 1}`
}

export default function PollBallotPage({ slug, user }: { slug: PollCategorySlug; user: PlatformUser }) {
  const [view, setView] = useState<PollBallotView | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isReviewOpen, setIsReviewOpen] = useState(false)

  type SortKey = 'team' | 'currentSpi' | 'lastSeasonSpi' | 'powerRating'
  type SortDirection = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState<SortKey>('currentSpi')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  useEffect(() => {
    loadPollBallot(slug, user.id)
      .then((loaded) => {
        setView(loaded)
        const initial = Array.from({ length: loaded.category.rankLimit }, (_, idx) => {
          const rankedId = loaded.rankings[idx] ?? loaded.lockedTeamIds[idx]
          return rankedId ? String(rankedId) : ''
        })
        loaded.lockedTeamIds.forEach((teamId, idx) => {
          initial[idx] = String(teamId)
        })
        setSlots(initial)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load ballot.')
        setLoading(false)
      })
  }, [slug, user.id])

  const lockedCount = view?.lockedTeamIds.length ?? 0

  const teams = useMemo(() => {
    return (view?.candidates ?? []).map((c) => ({
      id: String(c.teamId),
      name: c.teamName,
      logoUrl: c.logoUrl,
      isD3: c.division === 3,
      currentSpi: c.currentSpi,
      previousSpi: c.previousSpi,
      powerRating: c.powerRating,
      spiRank: c.spiRank,
    }))
  }, [view])

  const candidatesById = useMemo(() => {
    return new Map(teams.map((t) => [t.id, t]))
  }, [teams])

  const filledCount = slots.filter(Boolean).length
  const slotCount = view?.category.rankLimit ?? 0

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection(key === 'powerRating' ? 'desc' : 'asc')
    }
  }

  function handleReset() {
    setSlots(slots.map((id, idx) => (idx < lockedCount ? id : '')))
    setMessage('')
  }

  function handleQuickSelectTeam(teamId: string) {
    if (slots.includes(teamId)) return
    const emptyIndex = slots.findIndex((id, idx) => !id && idx >= lockedCount)
    if (emptyIndex !== -1) {
      const next = [...slots]
      next[emptyIndex] = teamId
      setSlots(next)
      setMessage('')
    }
  }

  function handleSubmitClick() {
    if (!view) return
    const numericSlots = slots.map((s) => (s ? Number(s) : 0))
    const problem = validateBallotTeamIds(
      numericSlots,
      view.category.rankLimit,
      new Set(view.candidates.map((c) => c.teamId)),
      view.lockedTeamIds
    )
    if (problem) {
      setMessage(problem)
      return
    }
    setMessage('')
    setIsReviewOpen(true)
  }

  async function handleConfirmSubmit() {
    if (!view) return
    setIsReviewOpen(false)
    setSubmitting(true)
    setMessage('')

    try {
      const numericSlots = slots.map((s) => Number(s))
      await savePollBallot({
        definitionId: view.definitionId,
        teamIds: numericSlots,
        submit: true,
      })
      window.location.hash = '#/polls'
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to submit ballot.')
      setSubmitting(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-[50vh] bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200 text-center max-w-sm w-full shadow-sm">
          <p className="text-xs text-red-600 mb-3">{error}</p>
          <a href="#/polls" className="text-xs font-medium text-green-700 hover:text-green-800">
            ← Back to all ballots
          </a>
        </div>
      </div>
    )
  }

  if (loading || !view) {
    return (
      <div className="min-h-[50vh] bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (view.prerequisite === 'overall-required') {
    const isMen = view.category.gender === 'Men'
    const prereqLabel = isMen ? "Men's Team Overall" : "Women's Team Overall"
    const prereqSlug = isMen ? 'men_team_overall' : 'women_team_overall'

    return (
      <div className="min-h-[50vh] bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-lg p-8 max-w-sm w-full text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-4">
            <Lock className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Complete overall ballot first</h2>
          <p className="mt-2 text-sm text-gray-500">
            You must submit <span className="font-medium text-gray-700">{prereqLabel}</span> before voting in this Division III category. Your D3 teams will be automatically pre-filled from your overall ballot.
          </p>
          <a
            href={`#/polls/vote/${prereqSlug}`}
            className="mt-5 inline-block px-4 py-2 text-sm font-medium text-white bg-green-700 rounded-md hover:bg-green-800 transition-colors shadow-sm"
          >
            Go to {prereqLabel}
          </a>
          <a href="#/polls" className="mt-3 block text-sm text-gray-500 hover:text-gray-700">
            ← Back to all ballots
          </a>
        </div>
      </div>
    )
  }

  const sortedCandidates = [...teams].sort((a, b) => {
    let comp = 0
    if (sortKey === 'team') comp = a.name.localeCompare(b.name)
    else if (sortKey === 'currentSpi') comp = a.spiRank - b.spiRank
    else if (sortKey === 'lastSeasonSpi') comp = (a.previousSpi ?? 999) - (b.previousSpi ?? 999)
    else if (sortKey === 'powerRating') comp = (a.powerRating ?? 0) - (b.powerRating ?? 0)
    return sortDirection === 'asc' ? comp : -comp
  })

  return (
    <div className="bg-gray-50 pt-0 pb-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Top Nav & Title (Compact top spacing) */}
        <div className="mb-3">
          <a href="#/polls" className="text-xs font-medium text-green-700 hover:text-green-800 flex items-center gap-1">
            ← All ballots
          </a>
          <div className="mt-1 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{view.category.label}</h1>
              <p className="text-xs text-gray-500">{view.period.label}</p>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              {view.period.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Info Banner if already submitted */}
        {view.submitted && (
          <div className="mb-3 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>You have already submitted this ballot. Make your changes and resubmit to update it.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Ballot Form */}
          <div className="lg:col-span-5 xl:col-span-5">
            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-600">
                  <span className={filledCount === slotCount ? 'text-green-700 font-bold' : 'font-semibold'}>
                    {filledCount}
                  </span>
                  <span className="text-gray-400"> / {slotCount} teams selected</span>
                </p>
                {slots.some((id, idx) => id && idx >= lockedCount) && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear editable
                  </button>
                )}
              </div>

              {message && (
                <div className="mb-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
                  {message}
                </div>
              )}

              {/* Stack of Slots */}
              <div className="space-y-1.5">
                {Array.from({ length: slotCount }, (_, i) => {
                  const isLocked = i < lockedCount
                  const lockedTeam = isLocked ? candidatesById.get(slots[i]) : null

                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-md bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-500 tabular-nums flex items-center justify-center flex-shrink-0">
                        #{i + 1}
                      </span>

                      {isLocked ? (
                        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-gray-200 shadow-2xs">
                          <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <TeamLogo name={lockedTeam?.name ?? ''} logoUrl={lockedTeam?.logoUrl} size={18} />
                          <span className="text-xs font-medium text-gray-900 truncate">
                            {lockedTeam?.name ?? 'Loading…'}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400 ml-auto whitespace-nowrap">
                            Locked
                          </span>
                        </div>
                      ) : (
                        <TeamSelectCombobox
                          rankNumber={i + 1}
                          selectedTeamId={slots[i] ?? ''}
                          teams={teams}
                          selectedTeamIds={slots}
                          onSelectTeam={(val) => {
                            const next = [...slots]
                            next[i] = val
                            setSlots(next)
                            setMessage('')
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitClick}
                  disabled={submitting || !view.period.effectivelyOpen}
                  className="w-full inline-flex justify-center items-center px-5 py-2.5 rounded-lg text-sm font-semibold bg-green-700 text-white hover:bg-green-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  Review ballot
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: SPI Reference Table */}
          <div className="lg:col-span-7 xl:col-span-7">
            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 sm:p-5">
              <div className="mb-1">
                <h2 className="text-sm font-bold text-gray-900">{view.category.label} SPI (Overall)</h2>
              </div>
              <p className="text-xs text-gray-500 mb-2.5">Reference index & power ratings to guide your vote</p>

              <div className="max-h-[640px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-white sticky top-0 z-10 border-b border-gray-100">
                    <tr>
                      <th
                        scope="col"
                        onClick={() => handleSort('team')}
                        className="py-2 px-1.5 font-semibold text-[11px] text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none text-left"
                      >
                        <div className="flex items-center gap-1">
                          <span>TEAM</span>
                          <span className="text-[10px]">
                            {sortKey === 'team' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th
                        scope="col"
                        onClick={() => handleSort('currentSpi')}
                        className="py-2 px-1.5 font-semibold text-[11px] text-gray-400 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:text-gray-700 select-none"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>CURRENT SPI</span>
                          <span className="text-[10px]">
                            {sortKey === 'currentSpi' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th
                        scope="col"
                        onClick={() => handleSort('lastSeasonSpi')}
                        className="py-2 px-1.5 font-semibold text-[11px] text-gray-400 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:text-gray-700 select-none"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>{getPrevSeasonLabel().toUpperCase()}</span>
                          <span className="text-[10px]">
                            {sortKey === 'lastSeasonSpi' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th
                        scope="col"
                        onClick={() => handleSort('powerRating')}
                        className="py-2 px-1.5 font-semibold text-[11px] text-gray-400 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:text-gray-700 select-none"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>POWER RATING</span>
                          <span className="text-[10px]">
                            {sortKey === 'powerRating' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th scope="col" className="py-2 px-1.5 font-semibold text-[11px] text-gray-400 uppercase tracking-wider text-right whitespace-nowrap">
                        ACTION
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedCandidates.map((item) => {
                      const isSelected = slots.includes(item.id)
                      const nextEmptySlot = slots.findIndex((id, idx) => !id && idx >= lockedCount)

                      return (
                        <tr key={item.id} className="hover:bg-gray-50/75 transition-colors">
                          <td className="py-1.5 px-1.5 text-xs font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <TeamLogo name={item.name} logoUrl={item.logoUrl} size={18} />
                              <span className="truncate">{item.name}</span>
                              {item.isD3 && (
                                <span className="inline-block px-1 text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded flex-shrink-0">
                                  D3
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 px-1.5 text-xs font-semibold text-gray-600 tabular-nums text-center whitespace-nowrap">
                            #{item.spiRank}
                          </td>
                          <td className="py-1.5 px-1.5 text-xs text-gray-400 tabular-nums text-center whitespace-nowrap">
                            {item.previousSpi != null ? `#${Math.round(item.previousSpi)}` : '—'}
                          </td>
                          <td className="py-1.5 px-1.5 text-xs font-medium text-gray-700 tabular-nums text-center whitespace-nowrap">
                            {item.powerRating != null ? item.powerRating.toFixed(1) : '—'}
                          </td>
                          <td className="py-1.5 px-1.5 text-right whitespace-nowrap">
                            {isSelected ? (
                              <span className="text-xs font-bold text-green-700">✓ Voted</span>
                            ) : nextEmptySlot !== -1 ? (
                              <button
                                type="button"
                                aria-label={`Rank ${item.name} at position ${nextEmptySlot + 1}`}
                                onClick={() => handleQuickSelectTeam(item.id)}
                                className="px-2 py-0.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded border border-green-200 transition-colors"
                              >
                                + Rank {nextEmptySlot + 1}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submission Confirmation Modal Dialog */}
      {isReviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-md w-full">
            <h2 className="text-base font-bold text-gray-900 mb-1">Confirm your ballot</h2>
            <p className="text-xs text-gray-500 mb-4">{view.category.label}</p>

            <ol className="divide-y divide-gray-100 max-h-72 overflow-y-auto mb-5 text-xs text-gray-800">
              {slots.map((id, idx) => (
                <li key={idx} className="py-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-400 w-8">#{idx + 1}</span>
                  <span className="font-medium flex-1 text-gray-900 truncate">
                    {candidatesById.get(id)?.name ?? <span className="text-red-400">Empty</span>}
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Continue editing
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : view.submitted ? 'Confirm and update' : 'Confirm and submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
