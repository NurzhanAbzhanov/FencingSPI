import type { PlatformUser, PollResult, Program, SeasonMatch, Standing } from "../types/platform";
import type { Gender, Weapon } from "../types/types";
import { supabase } from "./supabase";

export const SEASONS = [
    { slug: "2025-26", name: "2025-26" },
    { slug: "2024-25", name: "2024-25" },
    { slug: "2023-24", name: "2023-24" },
    { slug: "2022-23", name: "2022-23" },
] as const;

export const POLL_MONTHS = ["October", "November", "December", "January"] as const;

export async function loadPrograms(season: string): Promise<Program[]> {
    if (!supabase) return [];
    if (season !== "2025-26") return [];

    const result = await supabase.from("programs").select("legacy_team_id, gender, schools!inner(name, logo_url, conference, region), program_seasons(division, conference, region, seasons!inner(slug))");
    if (result.error || !result.data) return [];
    type DatabaseProgram = { legacy_team_id: number; gender: Gender; schools: { name: string; logo_url: string | null; conference: string; region: string } | Array<{ name: string; logo_url: string | null; conference: string; region: string }>; program_seasons: Array<{ division: number; conference: string; region: string; seasons: { slug: string } | Array<{ slug: string }> }> };
    return (result.data as unknown as DatabaseProgram[]).flatMap((row) => {
        const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
        const programSeason = row.program_seasons.find((item) => {
            const linkedSeason = Array.isArray(item.seasons) ? item.seasons[0] : item.seasons;
            return linkedSeason?.slug === season;
        });
        if (!school || !programSeason) return [];
        return [{ id: Number(row.legacy_team_id), name: school.name, gender: row.gender, division: String(programSeason.division), conference: programSeason.conference || school.conference, region: programSeason.region || school.region, logoUrl: school.logo_url }];
    });
}

export async function loadMatches(season: string): Promise<SeasonMatch[]> {
    if (season !== "2025-26") return [];
    return [];
}

export async function loadStandings(
    season: string,
    programs?: Program[]
): Promise<Standing[]> {
    if (season !== "2025-26") return [];
    const baseRankings = [
        { teamName: "University of Notre Dame", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 113.8884 },
        { teamName: "Columbia University-Barnard College", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 109.9821 },
        { teamName: "Yale University", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 108.6724 },
        { teamName: "St. John's University (New York)", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 106.4202 },
        { teamName: "University of Pennsylvania", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 104.7385 },
        { teamName: "University of North Carolina, Chapel Hill", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 100.1524 },
        { teamName: "Boston College", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 96.8106 },
        { teamName: "Duke University", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 94.4861 },
        { teamName: "Stanford University", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 92.4444 },
        { teamName: "Princeton University", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 90.2179 },
        { teamName: "The Ohio State University", gender: "Men" as Gender, weapon: "Team" as Weapon, spi: 87.1669 },
        { teamName: "University of Notre Dame", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 128.2862 },
        { teamName: "Columbia University-Barnard College", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 123.5028 },
        { teamName: "Harvard University", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 108.3129 },
        { teamName: "Duke University", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 105.8469 },
        { teamName: "Northwestern University", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 103.1821 },
        { teamName: "University of North Carolina, Chapel Hill", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 101.5108 },
        { teamName: "Princeton University", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 99.5803 },
        { teamName: "Yale University", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 95.3025 },
        { teamName: "Cornell University", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 94.4858 },
        { teamName: "Brown University", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 91.5928 },
        { teamName: "Temple University", gender: "Women" as Gender, weapon: "Team" as Weapon, spi: 86.0573 },
    ];

    if (programs && programs.length > 0) {
        return baseRankings.flatMap((r) => {
            const prog = programs.find((p) => p.name.toLowerCase() === r.teamName.toLowerCase() && p.gender === r.gender);
            if (!prog) return [];
            return [{ teamId: prog.id, teamName: prog.name, gender: r.gender, weapon: r.weapon, spi: r.spi }];
        });
    }

    const response = await fetch("/spi-results.csv").catch(() => null);
    if (!response || !response.ok) {
        return baseRankings.map((r, i) => ({ teamId: i + 1, teamName: r.teamName, gender: r.gender, weapon: r.weapon, spi: r.spi }));
    }
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

function resolvePollMonth(label: string, monthNum?: number | null, opensAt?: string | null): string {
    const l = (label || '').toLowerCase();
    if (l.includes('oct')) return 'October';
    if (l.includes('nov')) return 'November';
    if (l.includes('dec')) return 'December';
    if (l.includes('jan')) return 'January';
    if (l.includes('feb')) return 'February';
    if (l.includes('mid') || l.includes('season')) return 'Mid-Season';
    if (l.includes('final')) return 'Final';

    if (opensAt) {
        const m = new Date(opensAt).getMonth();
        const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        if (names[m]) return names[m];
    }

    if (monthNum) {
        const numMap: Record<number, string> = { 10: 'October', 11: 'November', 12: 'December', 1: 'January', 2: 'February', 3: 'March', 4: 'April' };
        if (numMap[monthNum]) return numMap[monthNum];
    }
    return label;
}

export async function loadPollResults(season: string): Promise<PollResult[]> {
    if (!supabase) return [];
    const result = await supabase.from("published_poll_results").select("definition_id, rank, points, programs!inner(legacy_team_id), ballot_definitions!inner(gender, weapon, scope, poll_periods!inner(label, month, opens_at, seasons!inner(slug)))");
    if (result.error || !result.data) return [];
    type DatabasePoll = { definition_id: string; rank: number; points: number; programs: { legacy_team_id: number } | Array<{ legacy_team_id: number }>; ballot_definitions: { gender: Gender; weapon: Weapon; scope: "Overall" | "DIII"; poll_periods: { label: string; month?: number; opens_at?: string; seasons: { slug: string } | Array<{ slug: string }> } | Array<{ label: string; month?: number; opens_at?: string; seasons: { slug: string } | Array<{ slug: string }> }> } | Array<{ gender: Gender; weapon: Weapon; scope: "Overall" | "DIII"; poll_periods: { label: string; month?: number; opens_at?: string; seasons: { slug: string } | Array<{ slug: string }> } | Array<{ label: string; month?: number; opens_at?: string; seasons: { slug: string } | Array<{ slug: string }> }> }> };
    return (result.data as unknown as DatabasePoll[]).flatMap((row) => {
        const program = Array.isArray(row.programs) ? row.programs[0] : row.programs;
        const definition = Array.isArray(row.ballot_definitions) ? row.ballot_definitions[0] : row.ballot_definitions;
        const period = Array.isArray(definition?.poll_periods) ? definition.poll_periods[0] : definition?.poll_periods;
        const linkedSeason = period && (Array.isArray(period.seasons) ? period.seasons[0] : period.seasons);
        if (!program || !definition || !period || linkedSeason?.slug !== season) return [];
        const month = resolvePollMonth(period.label, period.month, period.opens_at) as PollResult["month"];
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
            id: String(user.id ?? "demo"),
            name: String(user.name ?? "Demo User"),
            role: user.role === "admin" ? "admin" : "coach",
            canVote: typeof user.canVote === "boolean" ? user.canVote : user.role === "coach",
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
