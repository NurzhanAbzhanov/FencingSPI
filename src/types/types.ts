
// Core enumeration types
export type Gender = "Men" | "Women";
export type Weapon = "Saber" | "Foil" | "Epee" | "Team";
export type Result = "W" | "L";

// Raw match results import
export type MatchRow = {
    id: number;

    timestamp: string;
    date: string;

    gender: Gender;

    leftTeamId: number;
    rightTeamId: number;

    leftSaber: number;
    leftFoil: number;
    leftEpee: number;

    rightSaber: number;
    rightFoil: number;
    rightEpee: number;

    host: string;
}

// Raw power rating import 
export type FencerRatingRow = {
    weapon: Exclude<Weapon, "Team">;
    powerRating: number;
    teamName: string;
    gender: Gender;
}

// Team entity
export type Team = {
    id: number;
    name: string;
    gender: Gender;
}

// Calculated squad Power Rating 
export type SquadPowerRating = {
    teamId: number;
    gender: Gender;
    weapon: Weapon;

    powerRating: number;
}

// Expanded results for internal calculations
export type SquadResult = {
    teamId: number;
    gender: Gender;
    weapon: Weapon;

    opponentTeamId: number;
    opponentSquadPowerRating: number;

    scoreFor: number;
    scoreAgainst: number;

    result: Result;

}

// Final SPI result
export type SpiResult = {
    teamId: number;
    gender: Gender;
    weapon: Weapon;
    
    lowWinPct: number;
    mediumWinPct: number;
    highWinPct: number;

    lowCategoryStrength: number;
    mediumCategoryStrength: number;
    highCategoryStrength: number;

    lowScore: number;
    mediumScore: number;
    highScore: number;

    prc: number;

    spi: number;
}