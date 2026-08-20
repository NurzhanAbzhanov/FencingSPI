import type { Gender, Weapon } from "./types";

export type Season = {
    slug: string;
    name: string;
    active: boolean;
};

export type Program = {
    id: number;
    name: string;
    gender: Gender;
    division: string;
    conference: string;
    conferences: string[];
    region: string;
    logoUrl: string | null;
};

export type SeasonMatch = {
    id: number;
    date: string;
    gender: Gender;
    leftTeamId: number;
    rightTeamId: number;
    leftSabre: number;
    leftFoil: number;
    leftEpee: number;
    rightSabre: number;
    rightFoil: number;
    rightEpee: number;
    host: string;
};

export type Standing = {
    teamId: number;
    teamName: string;
    gender: Gender;
    weapon: Weapon;
    spi: number;
};

export type PowerRatingRecord = {
    teamId: number;
    teamName: string;
    gender: Gender;
    weapon: Weapon;
    calculatedPowerRating: number;
};

export type PowerRatingOverride = {
    season: string;
    teamId: number;
    gender: Gender;
    weapon: Weapon;
    adjustedPowerRating: number;
    reason: string;
    updatedAt: string;
    updatedBy: string;
};

export type PollMonth = "October" | "November" | "December" | "January";
export type PollScope = "Overall" | "DIII";
export type PollStatus = "Draft" | "Open" | "Closed" | "Published";

export type BallotDefinition = {
    id: string;
    month: PollMonth;
    gender: Gender;
    weapon: Weapon;
    scope: PollScope;
    rankLimit: number;
    status: PollStatus;
};

export type BallotRanking = {
    teamId: number;
    rank: number;
};

export type BallotStatus = "draft" | "submitted" | "reopened";

export type BallotState = {
    ballotId: string | null;
    status: BallotStatus;
    rankings: BallotRanking[];
};

export type SubmittedBallotSummary = {
    ballotId: string;
    voterName: string;
    month: PollMonth;
    gender: Gender;
    weapon: Weapon;
    scope: PollScope;
    submittedAt: string;
};

export type CommitteeBallot = {
    ballotId: string;
    voterName: string;
    scope: PollScope;
    status: BallotStatus;
    rankings: BallotRanking[];
};

export type PollResult = {
    definitionId: string;
    teamId: number;
    month: PollMonth;
    gender: Gender;
    weapon: Weapon;
    scope: PollScope;
    rank: number;
    points: number;
};

export type UserRole = "coach" | "admin";
export type PlatformUser = {
    id: string;
    name: string;
    role: UserRole;
    canVote: boolean;
};
