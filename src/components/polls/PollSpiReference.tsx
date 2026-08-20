import { useMemo, useState } from 'react'
import type { PollCandidate } from '../../types/polls'
import SchoolLogo from '../SchoolLogo'

type SortKey = 'team' | 'currentSpi' | 'lastSeasonSpi' | 'powerRating'
type SortDirection = 'asc' | 'desc'

export default function PollSpiReference({
  candidates,
  onRank,
  rankedTeamIds,
}: {
  candidates: PollCandidate[]
  onRank: (teamId: number) => void
  rankedTeamIds: number[]
}) {
  const [sortKey, setSortKey] = useState<SortKey>('currentSpi')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const nextRank = rankedTeamIds.findIndex((teamId) => teamId === 0) + 1

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection(key === 'currentSpi' || key === 'powerRating' ? 'desc' : 'asc')
    }
  }

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      let comp = 0
      if (sortKey === 'team') comp = a.teamName.localeCompare(b.teamName)
      else if (sortKey === 'currentSpi') comp = a.currentSpi - b.currentSpi
      else if (sortKey === 'lastSeasonSpi')
        comp = (a.previousSpi ?? 999) - (b.previousSpi ?? 999)
      else if (sortKey === 'powerRating')
        comp = (a.powerRating ?? 0) - (b.powerRating ?? 0)
      return sortDirection === 'asc' ? comp : -comp
    })
  }, [candidates, sortKey, sortDirection])

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col h-full poll-reference">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0 poll-subheading">
        <h2 id="spi-reference-title" className="text-xs font-semibold text-gray-900">Reference Index & Power Ratings</h2>
        <span className="text-[11px] text-gray-500">{candidates.length} eligible programs</span>
      </div>

      <div className="overflow-y-auto max-h-[640px] platform-table-wrap">
        <table className="w-full text-left text-xs border-collapse platform-table poll-reference-table">
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <tr>
              <th
                scope="col"
                aria-label="SPI Rank"
                className="px-2 py-2 font-medium text-gray-500 uppercase tracking-wider text-center whitespace-nowrap w-14"
              >
                SPI<br />Rank
              </th>
              <th
                scope="col"
                aria-label="Team"
                onClick={() => handleSort('team')}
                className="px-3 py-2 font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none text-left"
              >
                <div className="flex items-center gap-1">
                  <span>Team</span>
                  <span className="text-[10px] text-gray-400">
                    {sortKey === 'team' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-label="Current SPI"
                onClick={() => handleSort('currentSpi')}
                className="px-2 py-2 font-medium text-gray-500 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Current SPI</span>
                  <span className="text-[10px] text-gray-400">
                    {sortKey === 'currentSpi' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-label="Last Season SPI"
                onClick={() => handleSort('lastSeasonSpi')}
                className="px-2 py-2 font-medium text-gray-500 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Last Season SPI</span>
                  <span className="text-[10px] text-gray-400">
                    {sortKey === 'lastSeasonSpi' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              <th
                scope="col"
                aria-label="Power Rating"
                onClick={() => handleSort('powerRating')}
                className="px-2 py-2 font-medium text-gray-500 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Power Rating</span>
                  <span className="text-[10px] text-gray-400">
                    {sortKey === 'powerRating' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-gray-500 uppercase tracking-wider text-right w-20">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedCandidates.map((candidate) => {
              const ranked = rankedTeamIds.includes(candidate.teamId)
              const program = {
                id: candidate.teamId,
                name: candidate.teamName,
                gender: 'Men' as const,
                division: String(candidate.division),
                conference: candidate.conference,
                conferences: candidate.conference ? [candidate.conference] : [],
                region: candidate.region,
                logoUrl: candidate.logoUrl ?? null,
              }

              return (
                <tr key={candidate.teamId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-2 py-2 text-xs font-medium text-gray-400 tabular-nums text-center whitespace-nowrap spi-rank-cell numeric">
                    #{candidate.spiRank}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-gray-900 poll-team-cell">
                    <div className="flex items-center gap-2.5 min-w-0 poll-team-identity">
                      <SchoolLogo program={program} size="small" />
                      <span className="truncate">{candidate.teamName}</span>
                      {candidate.division === 3 && (
                        <span className="inline-block px-1 text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded flex-shrink-0">
                          D3
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs font-semibold text-sky-700 tabular-nums text-center whitespace-nowrap current-spi-cell numeric">
                    {candidate.currentSpi.toFixed(4)}
                  </td>
                  <td
                    className="px-2 py-2 text-xs text-gray-400 tabular-nums text-center whitespace-nowrap previous-spi-cell numeric"
                    aria-label={candidate.previousSpi == null ? 'No prior-season SPI' : undefined}
                  >
                    {candidate.previousSpi != null ? candidate.previousSpi.toFixed(4) : '—'}
                  </td>
                  <td className="px-2 py-2 text-xs font-medium text-gray-700 tabular-nums text-center whitespace-nowrap numeric">
                    {candidate.powerRating != null ? candidate.powerRating.toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {ranked ? (
                      <span className="text-[11px] font-semibold text-green-700 poll-voted-state">
                        ✓ Voted
                      </span>
                    ) : nextRank ? (
                      <button
                        type="button"
                        aria-label={`Rank ${candidate.teamName} at position ${nextRank}`}
                        onClick={() => onRank(candidate.teamId)}
                        className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded border border-green-200 transition-colors poll-rank-action"
                      >
                        + Rank {nextRank}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        aria-label={`Ballot full: ${candidate.teamName} cannot be ranked`}
                        className="text-xs text-gray-300 cursor-not-allowed poll-rank-action"
                      >
                        Ballot full
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
