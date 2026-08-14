import type { Gender, Weapon } from './types';
import type { PollScope } from './platform';
import type { UserRole } from './platform';

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

export type PollPeriodStatus = 'draft' | 'open' | 'closed' | 'published';
export type PollBallotStatus = 'not_started' | 'draft' | 'submitted';

export type PollPeriodSummary = {
    id: string;
    label: string;
    seasonSlug: string;
    status: PollPeriodStatus;
    opensAt: string | null;
    closesAt: string | null;
    effectivelyOpen: boolean;
};

export type PollDashboardCategory = PollCategorySpec & {
    definitionId: string;
    ballotStatus: PollBallotStatus;
};

export type PollDashboard = {
    period: PollPeriodSummary | null;
    categories: PollDashboardCategory[];
};

export type PollCandidate = {
    programId: string;
    teamId: number;
    teamName: string;
    logoUrl: string | null;
    division: number;
    conference: string;
    region: string;
    currentSpi: number;
    previousSpi: number | null;
    spiRank: number;
    powerRating: number | null;
};

export type PollBallotView = {
    definitionId: string;
    period: PollPeriodSummary;
    category: PollCategorySpec;
    candidates: PollCandidate[];
    rankings: number[];
    submitted: boolean;
    prerequisite: 'ready' | 'overall-required';
    lockedTeamIds: number[];
};

export type PollCategoryResults = {
    definitionId: string;
    category: PollCategorySpec;
    standings: PollStanding[];
};

export type IndividualPollBallot = {
    ballotId: string;
    voterName: string;
    voterEmail?: string;
    rankings: Array<{ rank: number; teamId: number; teamName: string }>;
};

export type PollPeriodAdmin = PollPeriodSummary & {
    snapshotCapturedAt: string | null;
};

export type PollParticipationStatus = 'not_started' | 'draft' | 'submitted';
export type PollParticipationRow = {
    voterId: string;
    voterName: string;
    email: string;
    statuses: Record<string, PollParticipationStatus>;
};

export type CommitteeAccess = {
    email: string;
    displayName: string;
    role: UserRole;
    canVote: boolean;
    active: boolean;
    linked: boolean;
};

export type CommitteeAccessInput = Omit<CommitteeAccess, 'linked'>;
