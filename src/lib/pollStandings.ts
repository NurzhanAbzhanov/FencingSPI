// Shared point-computation logic used by /results and /public/results/[pollId]

export type VoteRow = {
  category: string
  rankings: string[] // index 0 = rank 1
}

export type TeamRow = {
  id: string
  name: string
}

export type Standing = {
  rank: number
  teamId: string
  teamName: string
  points: number
  firstPlaceVotes: number
}

export type CategoryMeta = {
  slug: string
  label: string
  slotCount: number
  hidden?: boolean  // if true, category is hidden from UI but preserved in DB
}

export const CATEGORIES: CategoryMeta[] = [
  { slug: 'men_team_overall',          label: "Men's Team Overall",          slotCount: 15 },
  { slug: 'women_team_overall',        label: "Women's Team Overall",        slotCount: 15 },
  { slug: 'men_team_diii',             label: "Men's Team Division III",     slotCount: 8  },
  { slug: 'women_team_diii',           label: "Women's Team Division III",   slotCount: 8  },
  { slug: 'men_squad_epee_overall',    label: "Men's Épée Overall",          slotCount: 15 },
  { slug: 'men_squad_foil_overall',    label: "Men's Foil Overall",          slotCount: 15 },
  { slug: 'men_squad_sabre_overall',   label: "Men's Sabre Overall",         slotCount: 15 },
  { slug: 'women_squad_epee_overall',  label: "Women's Épée Overall",        slotCount: 15 },
  { slug: 'women_squad_foil_overall',  label: "Women's Foil Overall",        slotCount: 15 },
  { slug: 'women_squad_sabre_overall', label: "Women's Sabre Overall",       slotCount: 15 },
  { slug: 'men_squad_epee_diii',       label: "Men's Épée Division III",     slotCount: 5,  hidden: true },
  { slug: 'men_squad_foil_diii',       label: "Men's Foil Division III",     slotCount: 5,  hidden: true },
  { slug: 'men_squad_sabre_diii',      label: "Men's Sabre Division III",    slotCount: 5,  hidden: true },
  { slug: 'women_squad_epee_diii',     label: "Women's Épée Division III",   slotCount: 5,  hidden: true },
  { slug: 'women_squad_foil_diii',     label: "Women's Foil Division III",   slotCount: 5,  hidden: true },
  { slug: 'women_squad_sabre_diii',    label: "Women's Sabre Division III",  slotCount: 5,  hidden: true },
]

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as readonly string[]

/**
 * Given a flat list of vote rows for a single category and a team UUID→name map,
 * compute ranked standings with points and first-place vote counts.
 *
 * Scoring: rank 1 → slotCount pts, rank N → 1 pt.
 * Tiebreaker: most first-place votes.
 */
export function computeStandings(
  votes: VoteRow[],
  teamMap: Map<string, string>,
  slotCount: number,
): Standing[] {
  const pointsMap = new Map<string, number>()
  const firstPlaceMap = new Map<string, number>()

  for (const vote of votes) {
    if (!Array.isArray(vote.rankings)) continue
    vote.rankings.forEach((teamId, index) => {
      if (!teamId) return
      const pts = slotCount - index
      pointsMap.set(teamId, (pointsMap.get(teamId) ?? 0) + pts)
      if (index === 0) {
        firstPlaceMap.set(teamId, (firstPlaceMap.get(teamId) ?? 0) + 1)
      }
    })
  }

  return Array.from(pointsMap.entries())
    .sort(([aId, aPoints], [bId, bPoints]) => {
      if (bPoints !== aPoints) return bPoints - aPoints
      return (firstPlaceMap.get(bId) ?? 0) - (firstPlaceMap.get(aId) ?? 0)
    })
    .map(([teamId, points], i) => ({
      rank: i + 1,
      teamId,
      teamName: teamMap.get(teamId) ?? teamId,
      points,
      firstPlaceVotes: firstPlaceMap.get(teamId) ?? 0,
    }))
}
