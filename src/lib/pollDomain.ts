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

export function getPollCategorySpec(slug: string): PollCategorySpec {
    const category = POLL_CATEGORY_SPECS.find((item) => item.slug === slug);

    if (!category) {
        throw new Error(`Unknown poll category: ${slug}`);
    }

    return category;
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

    const ordered = [...standings.values()]
        .sort((left, right) => (
            right.points - left.points
            || canonicalSchoolName(left.teamName).localeCompare(canonicalSchoolName(right.teamName))
            || left.teamId - right.teamId
        ));

    let previousPoints: number | null = null;
    let currentRank = 0;
    return ordered.map((standing, index) => {
        if (standing.points !== previousPoints) currentRank = index + 1;
        previousPoints = standing.points;
        return { ...standing, rank: currentRank };
    });
}

export function deriveLockedD3TeamIds(
    overallTeamIds: number[],
    d3TeamIds: Set<number>,
    rankLimit: number,
): number[] {
    return overallTeamIds.filter((teamId) => d3TeamIds.has(teamId)).slice(0, rankLimit);
}

export function validateBallotTeamIds(
    teamIds: number[],
    rankLimit: number,
    eligibleTeamIds: Set<number>,
    lockedPrefix: number[] = [],
): string | null {
    if (teamIds.length !== rankLimit) {
        return `Ballot must contain exactly ${rankLimit} teams.`;
    }

    if (teamIds.some((teamId) => teamId === 0)) {
        return 'Ballot rankings cannot contain zero team IDs.';
    }

    if (new Set(teamIds).size !== teamIds.length) {
        return 'Ballot rankings must be unique.';
    }

    if (teamIds.some((teamId) => !eligibleTeamIds.has(teamId))) {
        return 'Ballot rankings must contain only eligible teams.';
    }

    if (lockedPrefix.some((teamId, index) => teamIds[index] !== teamId)) {
        return 'Ballot rankings must preserve the locked prefix.';
    }

    return null;
}

function canonicalSchoolName(teamName: string): string {
    return teamName.trim().toLocaleLowerCase('en-US');
}
