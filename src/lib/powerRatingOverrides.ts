import type {
    PowerRatingOverride,
    PowerRatingRecord,
} from "../types/platform";
import type {
    Gender,
    SquadPowerRating,
    Weapon,
} from "../types/types";
import { supabase } from "./supabase";

const STORAGE_KEY = "spi-power-rating-overrides-v1";

export async function loadPowerRatingRecords(
    season: string
): Promise<PowerRatingRecord[]> {
    if (season !== "2025-26") {
        return [];
    }

    const response = await fetch("/spi-results.csv");
    if (!response.ok) {
        throw new Error("Could not load current power ratings.");
    }

    const lines = (await response.text()).trim().split(/\r?\n/);
    const headers = splitCsvLine(lines[0]);
    const records = new Map<string, PowerRatingRecord>();

    for (const line of lines.slice(1)) {
        const values = splitCsvLine(line);
        const row = Object.fromEntries(
            headers.map((header, index) => [header, values[index] ?? ""])
        );
        const gender = row.gender as Gender;
        const weapon = row.weapon as Weapon;

        if (
            !["Men", "Women"].includes(gender) ||
            !["Team", "Epee", "Foil", "Sabre"].includes(weapon)
        ) {
            continue;
        }

        const record: PowerRatingRecord = {
            teamId: Number(row.teamId),
            teamName: row.teamName,
            gender,
            weapon,
            calculatedPowerRating: Number((Number(row.prc) * 20).toFixed(6)),
        };
        records.set(createOverrideKey(record), record);
    }

    return [...records.values()];
}

export async function loadPowerRatingOverrides(
    season: string
): Promise<PowerRatingOverride[]> {
    if (!supabase) {
        return readLocalOverrides().filter((override) => override.season === season);
    }
    const authResult = await supabase.auth.getUser();
    if (!authResult.data.user) {
        return readLocalOverrides().filter((override) => override.season === season);
    }

    const result = await supabase
        .from("power_rating_overrides")
        .select(
            "adjusted_power_rating, reason, updated_at, weapon, seasons!inner(slug), programs!inner(legacy_team_id, gender), profiles!power_rating_overrides_updated_by_fkey(display_name)"
        )
        .eq("seasons.slug", season);

    if (result.error) {
        if (isMissingOverrideTableError(result.error)) {
            return readLocalOverrides().filter((override) => override.season === season);
        }
        throw result.error;
    }

    type DatabaseOverride = {
        adjusted_power_rating: number;
        reason: string;
        updated_at: string;
        weapon: Weapon;
        programs:
            | { legacy_team_id: number; gender: Gender }
            | Array<{ legacy_team_id: number; gender: Gender }>;
        profiles:
            | { display_name: string }
            | Array<{ display_name: string }>
            | null;
    };

    return (result.data as unknown as DatabaseOverride[]).flatMap((row) => {
        const program = Array.isArray(row.programs)
            ? row.programs[0]
            : row.programs;
        const profile = Array.isArray(row.profiles)
            ? row.profiles[0]
            : row.profiles;

        if (!program) {
            return [];
        }

        return [{
            season,
            teamId: Number(program.legacy_team_id),
            gender: program.gender,
            weapon: row.weapon,
            adjustedPowerRating: Number(row.adjusted_power_rating),
            reason: row.reason,
            updatedAt: row.updated_at,
            updatedBy: profile?.display_name ?? "Administrator",
        } satisfies PowerRatingOverride];
    });
}

export async function savePowerRatingOverride(
    override: PowerRatingOverride
): Promise<void> {
    if (!supabase) {
        saveLocalOverride(override);
        return;
    }
    const userResult = await supabase.auth.getUser();
    if (!userResult.data.user) {
        saveLocalOverride(override);
        return;
    }

    const [seasonResult, programResult] = await Promise.all([
        supabase.from("seasons").select("id").eq("slug", override.season).single(),
        supabase
            .from("programs")
            .select("id")
            .eq("legacy_team_id", override.teamId)
            .eq("gender", override.gender)
            .single(),
    ]);

    if (seasonResult.error) throw seasonResult.error;
    if (programResult.error) throw programResult.error;

    const result = await supabase.from("power_rating_overrides").upsert(
        {
            season_id: seasonResult.data.id,
            program_id: programResult.data.id,
            weapon: override.weapon,
            adjusted_power_rating: override.adjustedPowerRating,
            reason: override.reason,
            updated_at: override.updatedAt,
            updated_by: userResult.data.user.id,
        },
        { onConflict: "season_id,program_id,weapon" }
    );

    if (result.error) {
        if (isMissingOverrideTableError(result.error)) {
            saveLocalOverride(override);
            return;
        }
        throw result.error;
    }
}

export async function deletePowerRatingOverride(
    override: Pick<PowerRatingOverride, "season" | "teamId" | "gender" | "weapon">
): Promise<void> {
    if (!supabase) {
        deleteLocalOverride(override);
        return;
    }
    const authResult = await supabase.auth.getUser();
    if (!authResult.data.user) {
        deleteLocalOverride(override);
        return;
    }

    const [seasonResult, programResult] = await Promise.all([
        supabase.from("seasons").select("id").eq("slug", override.season).single(),
        supabase
            .from("programs")
            .select("id")
            .eq("legacy_team_id", override.teamId)
            .eq("gender", override.gender)
            .single(),
    ]);

    if (seasonResult.error) throw seasonResult.error;
    if (programResult.error) throw programResult.error;

    const result = await supabase
        .from("power_rating_overrides")
        .delete()
        .eq("season_id", seasonResult.data.id)
        .eq("program_id", programResult.data.id)
        .eq("weapon", override.weapon);

    if (result.error) {
        if (isMissingOverrideTableError(result.error)) {
            deleteLocalOverride(override);
            return;
        }
        throw result.error;
    }
}

export function applyPowerRatingOverrides(
    ratings: SquadPowerRating[],
    overrides: PowerRatingOverride[]
): SquadPowerRating[] {
    const overridesByKey = new Map(
        overrides.map((override) => [createOverrideKey(override), override])
    );

    return ratings.map((rating) => {
        const override = overridesByKey.get(createOverrideKey(rating));
        return override
            ? { ...rating, adjustedPowerRating: override.adjustedPowerRating }
            : rating;
    });
}

export function createOverrideKey(value: {
    teamId: number;
    gender: Gender;
    weapon: Weapon;
}): string {
    return `${value.teamId}:${value.gender}:${value.weapon}`;
}

function readLocalOverrides(): PowerRatingOverride[] {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
        return Array.isArray(value) ? value.filter(isPowerRatingOverride) : [];
    } catch {
        return [];
    }
}

function saveLocalOverride(override: PowerRatingOverride): void {
    const overrides = readLocalOverrides();
    const key = createOverrideKey(override);
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
            ...overrides.filter((item) => createOverrideKey(item) !== key),
            override,
        ])
    );
}

function deleteLocalOverride(override: {
    teamId: number;
    gender: Gender;
    weapon: Weapon;
}): void {
    const key = createOverrideKey(override);
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
            readLocalOverrides().filter((item) => createOverrideKey(item) !== key)
        )
    );
}

function isMissingOverrideTableError(error: {
    code?: string;
    message?: string;
}): boolean {
    return (
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("power_rating_overrides") === true
    );
}

function isPowerRatingOverride(value: unknown): value is PowerRatingOverride {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const row = value as Partial<PowerRatingOverride>;
    return (
        typeof row.season === "string" &&
        typeof row.teamId === "number" &&
        (row.gender === "Men" || row.gender === "Women") &&
        ["Team", "Epee", "Foil", "Sabre"].includes(row.weapon ?? "") &&
        typeof row.adjustedPowerRating === "number" &&
        typeof row.reason === "string" &&
        typeof row.updatedAt === "string" &&
        typeof row.updatedBy === "string"
    );
}

function splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
            if (quoted && line[index + 1] === '"') {
                value += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (character === "," && !quoted) {
            values.push(value);
            value = "";
        } else {
            value += character;
        }
    }
    values.push(value);
    return values;
}
