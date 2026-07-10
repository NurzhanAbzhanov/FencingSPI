import type {
    MatchRow,
    Result,
    SquadPowerRating,
    SquadResult,
    SpiResult,
    Weapon,
} from "../types/types";

type SpiCategory = "Low" | "Medium" | "High";

type CategoryStats = {
    wins: number;
    fenced: number;
    opponentPowerRatingTotal: number;
};

type CategoryStatsByCategory = Record<SpiCategory, CategoryStats>;

type ModifiedWinPercentages = Record<SpiCategory, number>;

const WEAPONS: Exclude<Weapon, "Team">[] = ["Epee", "Foil", "Sabre"];

const LOW_BASE_STRENGTH = 30;
const MEDIUM_BASE_STRENGTH = 40;

const LOW_STARTING_FENCED = 3;
const MEDIUM_STARTING_FENCED = 2;

const LOW_MULTIPLIERS: Record<number, number> = {
    20: 0.9,
    30: 1,
    40: 1.1,
};

const MEDIUM_MULTIPLIERS: Record<number, number> = {
    40: 0.9,
    50: 0.9,
    60: 1,
    70: 1.1,
};

export function calculateSPI(
    matches: MatchRow[],
    powerRatings: SquadPowerRating[]
): SpiResult[] {
    const squadResults = expandMatchRowsToSquadResults(matches, powerRatings);
    const grouped = groupSquadResults(squadResults);

    return Object.values(grouped).map((results) =>
        calculateSpiForGroup(results, powerRatings)
    );
}

function expandMatchRowsToSquadResults(
    matches: MatchRow[],
    powerRatings: SquadPowerRating[]
): SquadResult[] {
    const results: SquadResult[] = [];

    for (const match of matches) {
        for (const weapon of WEAPONS) {
            const leftScore = getWeaponScore(match, "left", weapon);
            const rightScore = getWeaponScore(match, "right", weapon);

            results.push(
                createSquadResult({
                    teamId: match.leftTeamId,
                    opponentTeamId: match.rightTeamId,
                    gender: match.gender,
                    weapon,
                    scoreFor: leftScore,
                    scoreAgainst: rightScore,
                    powerRatings,
                })
            );

            results.push(
                createSquadResult({
                    teamId: match.rightTeamId,
                    opponentTeamId: match.leftTeamId,
                    gender: match.gender,
                    weapon,
                    scoreFor: rightScore,
                    scoreAgainst: leftScore,
                    powerRatings,
                })
            );
        }

        const leftTotal = match.leftEpee + match.leftFoil + match.leftSabre;
        const rightTotal = match.rightEpee + match.rightFoil + match.rightSabre;

        results.push(
            createSquadResult({
                teamId: match.leftTeamId,
                opponentTeamId: match.rightTeamId,
                gender: match.gender,
                weapon: "Team",
                scoreFor: leftTotal,
                scoreAgainst: rightTotal,
                powerRatings,
            })
        );

        results.push(
            createSquadResult({
                teamId: match.rightTeamId,
                opponentTeamId: match.leftTeamId,
                gender: match.gender,
                weapon: "Team",
                scoreFor: rightTotal,
                scoreAgainst: leftTotal,
                powerRatings,
            })
        );
    }

    return results;
}

function createSquadResult(params: {
    teamId: number;
    opponentTeamId: number;
    gender: MatchRow["gender"];
    weapon: Weapon;
    scoreFor: number;
    scoreAgainst: number;
    powerRatings: SquadPowerRating[];
}): SquadResult {
    return {
        teamId: params.teamId,
        gender: params.gender,
        weapon: params.weapon,
        opponentTeamId: params.opponentTeamId,
        opponentSquadPowerRating: findPowerRating(
            params.powerRatings,
            params.opponentTeamId,
            params.gender,
            params.weapon
        ).adjustedPowerRating,
        scoreFor: params.scoreFor,
        scoreAgainst: params.scoreAgainst,
        result: getResult(params.scoreFor, params.scoreAgainst),
    };
}

function getWeaponScore(
    match: MatchRow,
    side: "left" | "right",
    weapon: Exclude<Weapon, "Team">
): number {
    if (side === "left") {
        if (weapon === "Epee") {
            return match.leftEpee;
        }

        if (weapon === "Foil") {
            return match.leftFoil;
        }

        return match.leftSabre;
    }

    if (weapon === "Epee") {
        return match.rightEpee;
    }

    if (weapon === "Foil") {
        return match.rightFoil;
    }

    return match.rightSabre;
}

function getResult(scoreFor: number, scoreAgainst: number): Result {
    return scoreFor > scoreAgainst ? "W" : "L";
}

function findPowerRating(
    powerRatings: SquadPowerRating[],
    teamId: number,
    gender: MatchRow["gender"],
    weapon: Weapon
): SquadPowerRating {
    const rating = powerRatings.find(
        (powerRating) =>
            powerRating.teamId === teamId &&
            powerRating.gender === gender &&
            powerRating.weapon === weapon
    );

    if (!rating) {
        throw new Error(
            `Could not find power rating for team ${teamId}, ${gender}, ${weapon}`
        );
    }

    return rating;
}

function categorizePowerRating(powerRating: number): SpiCategory {
    if (powerRating >= 80) {
        return "High";
    }

    if (powerRating >= 50) {
        return "Medium";
    }

    return "Low";
}

function groupSquadResults(
    squadResults: SquadResult[]
): Record<string, SquadResult[]> {
    const grouped: Record<string, SquadResult[]> = {};

    for (const result of squadResults) {
        const key = `${result.teamId}-${result.gender}-${result.weapon}`;

        if (!grouped[key]) {
            grouped[key] = [];
        }

        grouped[key].push(result);
    }

    return grouped;
}

function calculateCategoryStats(
    results: SquadResult[]
): CategoryStatsByCategory {
    const stats = createEmptyCategoryStats();

    for (const result of results) {
        const category = categorizePowerRating(result.opponentSquadPowerRating);

        stats[category].wins += result.result === "W" ? 1 : 0;
        stats[category].fenced += 1;
        stats[category].opponentPowerRatingTotal +=
            result.opponentSquadPowerRating;
    }

    return stats;
}

function createEmptyCategoryStats(): CategoryStatsByCategory {
    return {
        Low: {
            wins: 0,
            fenced: 0,
            opponentPowerRatingTotal: 0,
        },
        Medium: {
            wins: 0,
            fenced: 0,
            opponentPowerRatingTotal: 0,
        },
        High: {
            wins: 0,
            fenced: 0,
            opponentPowerRatingTotal: 0,
        },
    };
}

function calculateModifiedWinPct(
    category: SpiCategory,
    stats: CategoryStats
): number {
    if (category === "Low") {
        return (stats.wins + 2) / (stats.fenced + 3);
    }

    if (category === "Medium") {
        return (stats.wins + 1) / (stats.fenced + 2);
    }

    return stats.wins / (stats.fenced + 2);
}

function applyControllingWinPercentages(
    winPercentages: ModifiedWinPercentages
): ModifiedWinPercentages {
    const high = winPercentages.High;
    const medium = Math.max(winPercentages.Medium, high);
    const low = Math.max(winPercentages.Low, medium);

    return {
        Low: low,
        Medium: medium,
        High: high,
    };
}

function calculateAdjustedCategoryStrength(
    category: "Low" | "Medium",
    results: SquadResult[]
): number {
    const baseStrength =
        category === "Low" ? LOW_BASE_STRENGTH : MEDIUM_BASE_STRENGTH;
    const startingFenced =
        category === "Low" ? LOW_STARTING_FENCED : MEDIUM_STARTING_FENCED;
    const multipliers =
        category === "Low" ? LOW_MULTIPLIERS : MEDIUM_MULTIPLIERS;

    let weightedStrengthTotal = baseStrength * startingFenced;
    let fencedTotal = startingFenced;

    for (const result of results) {
        if (categorizePowerRating(result.opponentSquadPowerRating) !== category) {
            continue;
        }

        const fenced = 1;
        const multiplier = multipliers[result.opponentSquadPowerRating] ?? 0;

        weightedStrengthTotal += baseStrength * multiplier * fenced;
        fencedTotal += fenced;
    }

    return weightedStrengthTotal / fencedTotal;
}

function calculateHighCategoryStrength(stats: CategoryStats): number {
    if (stats.fenced === 0) {
        return 0;
    }

    return stats.opponentPowerRatingTotal / stats.fenced - 30;
}

function calculateSpiForGroup(
    results: SquadResult[],
    powerRatings: SquadPowerRating[]
): SpiResult {
    const firstResult = results[0];
    const stats = calculateCategoryStats(results);
    const modifiedWinPercentages = {
        Low: calculateModifiedWinPct("Low", stats.Low),
        Medium: calculateModifiedWinPct("Medium", stats.Medium),
        High: calculateModifiedWinPct("High", stats.High),
    };
    const controlledWinPercentages = applyControllingWinPercentages(
        modifiedWinPercentages
    );
    const lowCategoryStrength = calculateAdjustedCategoryStrength(
        "Low",
        results
    );
    const mediumCategoryStrength = calculateAdjustedCategoryStrength(
        "Medium",
        results
    );
    const highCategoryStrength = calculateHighCategoryStrength(stats.High);
    const lowScore = lowCategoryStrength * controlledWinPercentages.Low;
    const mediumScore =
        stats.Medium.wins + stats.High.wins === 0
            ? 0
            : mediumCategoryStrength * controlledWinPercentages.Medium;
    const highScore = highCategoryStrength * controlledWinPercentages.High;
    const ownPowerRating = findPowerRating(
        powerRatings,
        firstResult.teamId,
        firstResult.gender,
        firstResult.weapon
    );
    const prc = ownPowerRating.adjustedPowerRating * 0.05;

    return {
        teamId: firstResult.teamId,
        gender: firstResult.gender,
        weapon: firstResult.weapon,
        lowWinPct: controlledWinPercentages.Low,
        mediumWinPct: controlledWinPercentages.Medium,
        highWinPct: controlledWinPercentages.High,
        lowCategoryStrength,
        mediumCategoryStrength,
        highCategoryStrength,
        lowScore:
            stats.Low.wins + stats.Medium.wins + stats.High.wins === 0
                ? 0
                : lowScore,
        mediumScore,
        highScore,
        prc,
        spi:
            (stats.Low.wins + stats.Medium.wins + stats.High.wins === 0
                ? 0
                : lowScore) +
            mediumScore +
            highScore +
            prc,
    };
}
