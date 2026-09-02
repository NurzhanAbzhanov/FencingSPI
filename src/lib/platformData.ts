import type { PlatformUser, PollResult, Program, SeasonMatch, Standing } from "../types/platform";
import type { Gender, Weapon } from "../types/types";
import { supabase } from "./supabase";

export const SEASONS = [
    { slug: "2025-26", name: "2025-26" },
    { slug: "2024-25", name: "2024-25" },
    { slug: "2023-24", name: "2023-24" },
    { slug: "2022-23", name: "2022-23" },
    { slug: "2021-22", name: "2021-22" },
] as const;

export const POLL_MONTHS = ["October", "November", "December", "January"] as const;

export async function loadPrograms(season: string): Promise<Program[]> {
    if (!supabase) return [];

    let result = await supabase.from("programs").select("legacy_team_id, gender, schools!inner(name, logo_url, conference, region), program_seasons(division, conference, region, seasons!inner(slug), program_season_conferences(conference))");
    if (result.error) {
        // Keep existing deployments usable until the conference-membership migration is applied.
        result = await supabase.from("programs").select("legacy_team_id, gender, schools!inner(name, logo_url, conference, region), program_seasons(division, conference, region, seasons!inner(slug))");
    }
    if (result.error || !result.data) return [];
    type DatabaseProgram = { legacy_team_id: number; gender: Gender; schools: { name: string; logo_url: string | null; conference: string; region: string } | Array<{ name: string; logo_url: string | null; conference: string; region: string }>; program_seasons: Array<{ division: number; conference: string; region: string; seasons: { slug: string } | Array<{ slug: string }>; program_season_conferences?: Array<{ conference: string }> }> };
    return (result.data as unknown as DatabaseProgram[]).flatMap((row) => {
        const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
        const programSeason = row.program_seasons.find((item) => {
            const linkedSeason = Array.isArray(item.seasons) ? item.seasons[0] : item.seasons;
            return linkedSeason?.slug === season;
        });
        if (!school || !programSeason) return [];
        const primaryConference = programSeason.conference || school.conference;
        const conferences = [...new Set([
            primaryConference,
            ...(programSeason.program_season_conferences ?? []).map((membership) => membership.conference),
        ].filter((value) => value && value !== "Unassigned"))];
        return [{ id: Number(row.legacy_team_id), name: school.name, gender: row.gender, division: String(programSeason.division), conference: primaryConference, conferences: conferences.length ? conferences : ["Unassigned"], region: programSeason.region || school.region, logoUrl: school.logo_url }];
    });
}

export async function loadMatches(season: string): Promise<SeasonMatch[]> {
    if (!supabase) return [];

    type DatabaseMatch = {
        id: number;
        source_id: number | null;
        fenced_on: string;
        gender: Gender;
        left_sabre: number;
        left_foil: number;
        left_epee: number;
        right_sabre: number;
        right_foil: number;
        right_epee: number;
        host: string;
        left_program: { legacy_team_id: number } | Array<{ legacy_team_id: number }>;
        right_program: { legacy_team_id: number } | Array<{ legacy_team_id: number }>;
    };

    const pageSize = 1000;
    const databaseRows: DatabaseMatch[] = [];
    for (let start = 0; ; start += pageSize) {
        const result = await supabase
            .from("matches")
            .select(
                "id, source_id, fenced_on, gender, left_sabre, left_foil, left_epee, right_sabre, right_foil, right_epee, host, seasons!inner(slug), left_program:programs!matches_left_program_id_fkey(legacy_team_id), right_program:programs!matches_right_program_id_fkey(legacy_team_id)"
            )
            .eq("seasons.slug", season)
            .order("fenced_on", { ascending: true })
            .range(start, start + pageSize - 1);

        if (result.error || !result.data) return [];
        const page = result.data as unknown as DatabaseMatch[];
        databaseRows.push(...page);
        if (page.length < pageSize) break;
    }

    return databaseRows.flatMap((row) => {
        const leftProgram = Array.isArray(row.left_program) ? row.left_program[0] : row.left_program;
        const rightProgram = Array.isArray(row.right_program) ? row.right_program[0] : row.right_program;
        if (!leftProgram || !rightProgram) return [];

        return [{
            id: Number(row.source_id ?? row.id),
            date: row.fenced_on,
            gender: row.gender,
            leftTeamId: Number(leftProgram.legacy_team_id),
            rightTeamId: Number(rightProgram.legacy_team_id),
            leftSabre: Number(row.left_sabre),
            leftFoil: Number(row.left_foil),
            leftEpee: Number(row.left_epee),
            rightSabre: Number(row.right_sabre),
            rightFoil: Number(row.right_foil),
            rightEpee: Number(row.right_epee),
            host: row.host,
        } satisfies SeasonMatch];
    });
}

export async function loadStandings(
    season: string,
    _programs?: Program[]
): Promise<Standing[]> {
    void _programs;

    if (!supabase) return [];

    const result = await supabase
        .from("public_spi_standings")
        .select("team_id, team_name, gender, weapon, spi")
        .eq("season_slug", season)
        .order("spi", { ascending: false });

    if (result.error || !result.data) return [];

    return result.data.map((row) => ({
        teamId: Number(row.team_id),
        teamName: String(row.team_name),
        gender: row.gender as Gender,
        weapon: row.weapon as Weapon,
        spi: Number(row.spi),
    }));
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
        const programs = JSON.parse(localStorage.getItem("spi-local-programs") ?? "[]") as Array<Omit<Program, "conferences"> & { conferences?: string[] }>;
        return programs.map((program) => ({
            ...program,
            conferences: program.conferences?.length ? program.conferences : [program.conference || "Unassigned"],
        }));
    } catch {
        return [];
    }
}
