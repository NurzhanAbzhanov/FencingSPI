import teamsTsv from "../../teams.tsv?raw";
import type { Gender, Team } from "../types/types";

export const TEAMS: Team[] = parseTeams(teamsTsv);

function parseTeams(contents: string): Team[] {
    const lines = contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    return lines.slice(1).map((line) => {
        const [id, name, gender] = line.split("\t");

        if (!id || !name || !isGender(gender)) {
            throw new Error(`Invalid team row: ${line}`);
        }

        return {
            id: Number(id),
            name,
            gender,
        };
    });
}

function isGender(value: string): value is Gender {
    return value === "Men" || value === "Women";
}
