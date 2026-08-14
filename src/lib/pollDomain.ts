import type { Gender, Weapon } from '../types/types';
import type {
    PollCategorySlug,
    PollCategorySpec,
    PollStanding,
    PollVote,
} from '../types/polls';
import type { PollScope } from '../types/platform';

type CategoryDefinition = {
    slug: PollCategorySlug;
    label: string;
    gender: Gender;
    weapon: Weapon;
    scope: PollScope;
    rankLimit: number;
    hidden: boolean;
};

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
    { slug: 'men_team_overall', label: "Men's Team Overall", gender: 'Men', weapon: 'Team', scope: 'Overall', rankLimit: 15, hidden: false },
    { slug: 'women_team_overall', label: "Women's Team Overall", gender: 'Women', weapon: 'Team', scope: 'Overall', rankLimit: 15, hidden: false },
    { slug: 'men_team_diii', label: "Men's Team Division III", gender: 'Men', weapon: 'Team', scope: 'DIII', rankLimit: 8, hidden: false },
    { slug: 'women_team_diii', label: "Women's Team Division III", gender: 'Women', weapon: 'Team', scope: 'DIII', rankLimit: 8, hidden: false },
    { slug: 'men_squad_epee_overall', label: "Men's Epee Overall", gender: 'Men', weapon: 'Epee', scope: 'Overall', rankLimit: 15, hidden: false },
    { slug: 'women_squad_epee_overall', label: "Women's Epee Overall", gender: 'Women', weapon: 'Epee', scope: 'Overall', rankLimit: 15, hidden: false },
    { slug: 'men_squad_foil_overall', label: "Men's Foil Overall", gender: 'Men', weapon: 'Foil', scope: 'Overall', rankLimit: 15, hidden: false },
    { slug: 'women_squad_foil_overall', label: "Women's Foil Overall", gender: 'Women', weapon: 'Foil', scope: 'Overall', rankLimit: 15, hidden: false },
    { slug: 'men_squad_sabre_overall', label: "Men's Sabre Overall", gender: 'Men', weapon: 'Sabre', scope: 'Overall', rankLimit: 15, hidden: false },
    { slug: 'women_squad_sabre_overall', label: "Women's Sabre Overall", gender: 'Women', weapon: 'Sabre', scope: 'Overall', rankLimit: 15, hidden: false },
    { slug: 'men_squad_epee_diii', label: "Men's Epee Division III", gender: 'Men', weapon: 'Epee', scope: 'DIII', rankLimit: 5, hidden: true },
    { slug: 'women_squad_epee_diii', label: "Women's Epee Division III", gender: 'Women', weapon: 'Epee', scope: 'DIII', rankLimit: 5, hidden: true },
    { slug: 'men_squad_foil_diii', label: "Men's Foil Division III", gender: 'Men', weapon: 'Foil', scope: 'DIII', rankLimit: 5, hidden: true },
    { slug: 'women_squad_foil_diii', label: "Women's Foil Division III", gender: 'Women', weapon: 'Foil', scope: 'DIII', rankLimit: 5, hidden: true },
    { slug: 'men_squad_sabre_diii', label: "Men's Sabre Division III", gender: 'Men', weapon: 'Sabre', scope: 'DIII', rankLimit: 5, hidden: true },
    { slug: 'women_squad_sabre_diii', label: "Women's Sabre Division III", gender: 'Women', weapon: 'Sabre', scope: 'DIII', rankLimit: 5, hidden: true },
];

export const POLL_CATEGORY_SPECS: PollCategorySpec[] = CATEGORY_DEFINITIONS;

export function normalizeCategorySlug(rawSlug: string): PollCategorySlug {
    let s = rawSlug;
    if (s.endsWith('_epee') || s.endsWith('_foil') || s.endsWith('_sabre')) {
        s = `${s}_overall`;
    }
    return s as PollCategorySlug;
}

export function getPollCategorySpec(slug: string): PollCategorySpec {
    const normalized = normalizeCategorySlug(slug);
    const category = POLL_CATEGORY_SPECS.find((item) => item.slug === normalized || item.slug === slug);

    if (!category) {
        throw new Error(`Unknown poll category: ${slug}`);
    }

    return category;
}

export function deriveLockedD3TeamIds(
    overallRankedTeamIds: number[],
    availableD3TeamIds: Set<number>,
    limit = 8,
): number[] {
    const locked: number[] = [];

    for (const teamId of overallRankedTeamIds) {
        if (availableD3TeamIds.has(teamId)) {
            locked.push(teamId);
            if (locked.length === limit) {
                break;
            }
        }
    }

    return locked;
}

export function computePollStandings(
    votes: PollVote[],
    teamNames: Map<number, string>,
    slotCount: number,
): PollStanding[] {
    const standings = new Map<number, Omit<PollStanding, 'rank'>>();

    for (const vote of votes) {
        vote.rankings.forEach((teamId, index) => {
            const teamName = teamNames.get(teamId);

            if (!teamName) {
                return;
            }

            const standing = standings.get(teamId) ?? {
                teamId,
                teamName,
                points: 0,
                firstPlaceVotes: 0,
            };

            standing.points += slotCount - index;
            if (index === 0) {
                standing.firstPlaceVotes += 1;
            }

            standings.set(teamId, standing);
        });
    }

    const sorted = [...standings.values()].sort((a, b) => {
        return (
            b.points - a.points ||
            a.teamName.localeCompare(b.teamName)
        );
    });

    let currentRank = 1;

    return sorted.map((standing, index) => {
        if (index > 0) {
            const previous = sorted[index - 1];
            const isTied = previous.points === standing.points;

            if (!isTied) {
                currentRank = index + 1;
            }
        }

        return {
            ...standing,
            rank: currentRank,
        };
    });
}

export function validateBallotTeamIds(
    teamIds: number[],
    rankLimit: number,
    eligibleTeamIds?: Set<number>,
    lockedPrefix?: number[],
): string | null {
    if (teamIds.length !== rankLimit) {
        return `Ballot must rank exactly ${rankLimit} teams.`;
    }
    if (teamIds.some((id) => !id || id === 0)) {
        return 'Ballot cannot contain zero or empty rankings.';
    }
    if (new Set(teamIds).size !== teamIds.length) {
        return 'Ballot rankings must be unique.';
    }
    if (eligibleTeamIds && teamIds.some((id) => !eligibleTeamIds.has(id))) {
        return 'Ballot contains non-eligible teams.';
    }
    if (lockedPrefix) {
        for (let i = 0; i < lockedPrefix.length; i++) {
            if (teamIds[i] !== lockedPrefix[i]) {
                return 'Ballot must keep locked prefix teams.';
            }
        }
    }
    return null;
}
