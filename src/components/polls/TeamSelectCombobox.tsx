import { useState, useRef, useEffect } from 'react'
import TeamLogo from './TeamLogo'

type TeamOption = {
  id: string
  name: string
  logoUrl?: string | null
}

export default function TeamSelectCombobox({
  rankNumber,
  selectedTeamId,
  teams,
  selectedTeamIds,
  onSelectTeam,
}: {
  rankNumber: number
  selectedTeamId: string
  teams: TeamOption[]
  selectedTeamIds: string[]
  onSelectTeam: (teamId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      {/* Selected Slot Button / Trigger */}
      <button
        type="button"
        aria-label={selectedTeam ? `Rank ${rankNumber}: ${selectedTeam.name}` : `Select Rank ${rankNumber} team`}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm bg-white hover:border-gray-300 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 transition-colors shadow-2xs"
      >
        {selectedTeam ? (
          <div className="flex items-center gap-2.5 truncate">
            <TeamLogo name={selectedTeam.name} logoUrl={selectedTeam.logoUrl} size={20} />
            <span className="font-medium text-gray-900 truncate">{selectedTeam.name}</span>
          </div>
        ) : (
          <span className="text-gray-400">Select Rank {rankNumber} team…</span>
        )}

        <svg className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Options List */}
      {isOpen && (
        <div className="absolute z-30 mt-1 w-full rounded-md bg-white border border-gray-200 shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams…"
              autoFocus
              className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:border-green-600 focus:outline-none bg-white"
            />
          </div>

          {/* List */}
          <ul className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {selectedTeamId && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onSelectTeam('')
                    setIsOpen(false)
                    setSearch('')
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  ✕ Clear Selection
                </button>
              </li>
            )}

            {filteredTeams.length === 0 ? (
              <li className="px-3 py-3 text-xs text-gray-400 text-center">No matching teams</li>
            ) : (
              filteredTeams.map((team) => {
                const isSelectedHere = team.id === selectedTeamId
                const isSelectedElsewhere = selectedTeamIds.includes(team.id) && !isSelectedHere

                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      disabled={isSelectedElsewhere}
                      onClick={() => {
                        onSelectTeam(team.id)
                        setIsOpen(false)
                        setSearch('')
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                        isSelectedHere
                          ? 'bg-green-50 text-green-900 font-medium'
                          : isSelectedElsewhere
                          ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <TeamLogo name={team.name} logoUrl={team.logoUrl} size={20} />
                        <span className="truncate">{team.name}</span>
                      </div>
                      {isSelectedHere && <span className="text-green-600 text-xs font-bold">✓</span>}
                      {isSelectedElsewhere && <span className="text-xs text-gray-400">Already ranked</span>}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
