import type { Gender, Weapon } from './types';
import type { PollScope } from './platform';

export type PollCategorySlug =
    | 'men_team_overall'
    | 'women_team_overall'
    | 'men_team_diii'
    | 'women_team_diii'
    | 'men_squad_epee_overall'
    | 'women_squad_epee_overall'
    | 'men_squad_foil_overall'
    | 'women_squad_foil_overall'
    | 'men_squad_sabre_overall'
    | 'women_squad_sabre_overall'
    | 'men_squad_epee_diii'
    | 'women_squad_epee_diii'
    | 'men_squad_foil_diii'
    | 'women_squad_foil_diii'
    | 'men_squad_sabre_diii'
    | 'women_squad_sabre_diii';

export type PollCategorySpec = {
    slug: PollCategorySlug;
    label: string;
    gender: Gender;
    weapon: Weapon;
    scope: PollScope;
    rankLimit: number;
    hidden: boolean;
};

export type PollVote = { rankings: number[] };

export type PollStanding = {
    rank: number;
    teamId: number;
    teamName: string;
    points: number;
    firstPlaceVotes: number;
};
