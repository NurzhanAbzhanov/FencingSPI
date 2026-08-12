import type { SpiResultRow } from "../components/ResultsTable";
import type {
    PlatformUser,
    PollResult,
    Program,
    Season,
    SeasonMatch,
    Standing,
} from "../types/platform";
import type { Gender, Weapon } from "../types/types";
import { supabase } from "./supabase";

export const SEASONS: Season[] = [
    { slug: "2025-26", name: "2025-26", active: true },
    { slug: "2024-25", name: "2024-25", active: false },
    { slug: "2023-24", name: "2023-24", active: false },
    { slug: "2022-23", name: "2022-23", active: false },
    { slug: "2021-22", name: "2021-22", active: false },
];

export const POLL_MONTHS = ["October", "November", "December", "January"] as const;

export async function loadPrograms(season: string): Promise<Program[]> {
    if (season !== "2025-26") return [];
    const staticPrograms = await fetchJson<Program[]>("/programs-2025-26.json");
    if (!supabase) return staticPrograms;
    const result = await supabase.from("programs").select("legacy_team_id, gender, schools!inner(name, logo_url, conference, region), program_seasons(division, conference, region, seasons!inner(slug))");
    if (result.error || !result.data) return staticPrograms;
    type DatabaseProgram = { legacy_team_id: number; gender: Gender; schools: { name: string; logo_url: string | null; conference: string; region: string } | Array<{ name: string; logo_url: string | null; conference: string; region: string }>; program_seasons: Array<{ division: number; conference: string; region: string; seasons: { slug: string } | Array<{ slug: string }> }> };
    const databasePrograms = (result.data as unknown as DatabaseProgram[]).flatMap((row) => {
        const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
        const programSeason = row.program_seasons.find((item) => {
            const linkedSeason = Array.isArray(item.seasons) ? item.seasons[0] : item.seasons;
            return linkedSeason?.slug === season;
        });
        if (!school || !programSeason) return [];
        return [{ id: Number(row.legacy_team_id), name: school.name, gender: row.gender, division: String(programSeason.division), conference: programSeason.conference || school.conference, region: programSeason.region || school.region, logoUrl: school.logo_url } satisfies Program];
    });
    return [...staticPrograms.filter((item) => !databasePrograms.some((database) => database.id === item.id)), ...databasePrograms];
}

export async function loadMatches(season: string): Promise<SeasonMatch[]> {
    if (season !== "2025-26") return [];
    return fetchJson<SeasonMatch[]>("/matches-2025-26.json");
}

export async function loadStandings(
    season: string,
    generatedRows?: SpiResultRow[]
): Promise<Standing[]> {
    if (season !== "2025-26") return [];
    if (generatedRows?.length) return generatedRows.map(toStanding);

    const response = await fetch("/spi-results.csv");
    if (!response.ok) throw new Error("Could not load SPI standings.");
    const lines = (await response.text()).trim().split(/\r?\n/);
    const headers = splitCsvLine(lines[0]);

    return lines.slice(1).map((line) => {
        const values = splitCsvLine(line);
        const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
        return {
            teamId: Number(row.teamId),
            teamName: row.teamName,
            gender: row.gender as Gender,
            weapon: row.weapon as Weapon,
            spi: Number(row.spi),
        };
    });
}

export async function loadPollResults(season: string): Promise<PollResult[]> {
    if (!supabase) return [];
    const result = await supabase.from("published_poll_results").select("definition_id, rank, points, programs!inner(legacy_team_id), ballot_definitions!inner(gender, weapon, scope, poll_periods!inner(label, seasons!inner(slug)))");
    if (result.error || !result.data) return [];
    type DatabasePoll = { definition_id: string; rank: number; points: number; programs: { legacy_team_id: number } | Array<{ legacy_team_id: number }>; ballot_definitions: { gender: Gender; weapon: Weapon; scope: "Overall" | "DIII"; poll_periods: { label: string; seasons: { slug: string } | Array<{ slug: string }> } | Array<{ label: string; seasons: { slug: string } | Array<{ slug: string }> }> } | Array<{ gender: Gender; weapon: Weapon; scope: "Overall" | "DIII"; poll_periods: { label: string; seasons: { slug: string } | Array<{ slug: string }> } | Array<{ label: string; seasons: { slug: string } | Array<{ slug: string }> }> }> };
    return (result.data as unknown as DatabasePoll[]).flatMap((row) => {
        const program = Array.isArray(row.programs) ? row.programs[0] : row.programs;
        const definition = Array.isArray(row.ballot_definitions) ? row.ballot_definitions[0] : row.ballot_definitions;
        const period = Array.isArray(definition?.poll_periods) ? definition.poll_periods[0] : definition?.poll_periods;
        const linkedSeason = period && (Array.isArray(period.seasons) ? period.seasons[0] : period.seasons);
        if (!program || !definition || !period || linkedSeason?.slug !== season) return [];
        const month = (period.label.startsWith("October") ? "October" : period.label) as PollResult["month"];
        return [{ definitionId: row.definition_id, teamId: Number(program.legacy_team_id), month, gender: definition.gender, weapon: definition.weapon, scope: definition.scope, rank: row.rank, points: row.points }];
    });
}

const DEMO_USER_KEY = "spi-platform-demo-user";

export function readDemoUser(): PlatformUser | null {
    const value = localStorage.getItem(DEMO_USER_KEY);
    if (!value) return null;
    try {
        const user = JSON.parse(value) as PlatformUser;
        return {
            ...user,
            canVote: typeof user.canVote === "boolean"
                ? user.canVote
                : user.role === "coach",
        };
    } catch {
        return null;
    }
}

export function signInDemo(role: "coach" | "admin"): PlatformUser {
    const user = {
        id: role === "admin" ? "demo-admin" : "demo-coach-1",
        name: role === "admin" ? "Committee Administrator" : "Coach 1",
        role,
        canVote: role === "coach",
    } satisfies PlatformUser;
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
    return user;
}

export function signOutDemo() {
    localStorage.removeItem(DEMO_USER_KEY);
}

export function addLocalProgram(program: Program) {
    const current = readLocalPrograms();
    localStorage.setItem("spi-local-programs", JSON.stringify([...current, program]));
}

export function readLocalPrograms(): Program[] {
    try {
        return JSON.parse(localStorage.getItem("spi-local-programs") ?? "[]") as Program[];
    } catch {
        return [];
    }
}

function toStanding(row: SpiResultRow): Standing {
    return {
        teamId: Number(row.teamId),
        teamName: row.teamName,
        gender: row.gender as Gender,
        weapon: row.weapon as Weapon,
        spi: Number(row.spi),
    };
}

async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path}.`);
    return response.json() as Promise<T>;
}

function splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (quoted && line[index + 1] === '"') {
                value += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (char === "," && !quoted) {
            values.push(value);
            value = "";
        } else {
            value += char;
        }
    }
    values.push(value);
    return values;
}
