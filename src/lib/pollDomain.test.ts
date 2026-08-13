import { describe, expect, it } from 'vitest';
import {
    computePollStandings,
    deriveLockedD3TeamIds,
    getPollCategorySpec,
    POLL_CATEGORY_SPECS,
    validateBallotTeamIds,
} from './pollDomain';

describe('poll categories', () => {
    it('defines ten visible categories and the supplied team and hidden weapon rules', () => {
        expect(POLL_CATEGORY_SPECS.filter((item) => !item.hidden)).toHaveLength(10);
        expect(getPollCategorySpec('men_team_diii')).toMatchObject({
            rankLimit: 8,
            scope: 'DIII',
            weapon: 'Team',
        });
        expect(getPollCategorySpec('women_squad_sabre_diii')).toMatchObject({
            rankLimit: 5,
            hidden: true,
        });
    });

    it('rejects invalid category slugs', () => {
        expect(() => getPollCategorySpec('not-a-category')).toThrow('Unknown poll category');
    });
});

describe('computePollStandings', () => {
    it('awards reverse rank points and preserves a complete tie', () => {
        expect(computePollStandings([
            { rankings: [1, 2, 3] },
            { rankings: [2, 1, 3] },
        ], new Map([[1, 'Alpha'], [2, 'Beta'], [3, 'Gamma']]), 3)).toEqual([
            { rank: 1, teamId: 1, teamName: 'Alpha', points: 5, firstPlaceVotes: 1 },
            { rank: 1, teamId: 2, teamName: 'Beta', points: 5, firstPlaceVotes: 1 },
            { rank: 3, teamId: 3, teamName: 'Gamma', points: 2, firstPlaceVotes: 0 },
        ]);
    });

    it('does not use first-place votes to break point ties', () => {
        expect(computePollStandings([
            { rankings: [1, 2, 3] },
            { rankings: [1, 3, 2] },
            { rankings: [2, 3, 1] },
            { rankings: [3, 2, 1] },
        ], new Map([[1, 'Zeta'], [2, 'Alpha'], [3, 'Gamma']]), 3)).toMatchObject([
            { rank: 1, points: 8 },
            { rank: 1, points: 8 },
            { rank: 1, points: 8 },
        ]);
    });

    it('uses canonical school name only for deterministic display order after a tie', () => {
        expect(computePollStandings([
            { rankings: [2, 1] },
            { rankings: [1, 2] },
        ], new Map([[1, 'zeta university'], [2, 'Alpha College']]), 2))
            .toMatchObject([{ rank: 1, teamId: 2 }, { rank: 1, teamId: 1 }]);
    });
});

describe('ballot validation', () => {
    const eligibleTeamIds = new Set([1, 2, 3, 4]);

    it('requires full, unique, non-zero rankings', () => {
        expect(validateBallotTeamIds([1, 2], 3, eligibleTeamIds)).toContain('3');
        expect(validateBallotTeamIds([1, 2, 0], 3, eligibleTeamIds)).toContain('zero');
        expect(validateBallotTeamIds([1, 1, 2], 3, eligibleTeamIds)).toContain('unique');
    });

    it('requires eligible teams and an unchanged locked prefix', () => {
        expect(validateBallotTeamIds([1, 2, 9], 3, eligibleTeamIds)).toContain('eligible');
        expect(validateBallotTeamIds([2, 1, 3], 3, eligibleTeamIds, [1])).toContain('locked');
        expect(validateBallotTeamIds([1, 2, 3], 3, eligibleTeamIds, [1])).toBeNull();
    });
});

describe('Division III locks', () => {
    it('keeps eligible Division III teams in overall rank order up to the DIII limit', () => {
        expect(deriveLockedD3TeamIds([9, 3, 7, 5], new Set([3, 5]), 8)).toEqual([3, 5]);
    });
});
