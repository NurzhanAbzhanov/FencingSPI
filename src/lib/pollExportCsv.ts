import { CATEGORIES, type Standing } from './pollStandings'

type StandingsByCategory = Record<string, Standing[]>

export function exportPollResultsCsv(
  pollLabel: string,
  standings: StandingsByCategory,
  ballotCounts: Record<string, number>
) {
  const rows: string[][] = []

  // Header row
  rows.push(['Category', 'Rank', 'Team Name', 'Points', '1st-Place Votes', 'Total Category Ballots'])

  CATEGORIES.forEach((cat) => {
    const catStandings = standings[cat.slug] ?? []
    const ballotCount = ballotCounts[cat.slug] ?? 0

    if (catStandings.length === 0) {
      rows.push([cat.label, '—', 'No votes recorded', '0', '0', String(ballotCount)])
    } else {
      catStandings.forEach((s) => {
        rows.push([
          cat.label,
          String(s.rank),
          `"${s.teamName.replace(/"/g, '""')}"`,
          String(s.points),
          String(s.firstPlaceVotes),
          String(ballotCount),
        ])
      })
    }
  })

  // Convert array of rows to CSV string
  const csvContent = rows.map((r) => r.join(',')).join('\n')

  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const cleanLabel = pollLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  link.setAttribute('href', url)
  link.setAttribute('download', `USFCA_Coaches_Poll_${cleanLabel}_results.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
