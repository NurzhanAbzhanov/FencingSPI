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

export type FencerRatingUploadRow = {
    teamName: string;
    weapon: Exclude<Weapon, "Team">;
    powerRating: number;
};

export async function loadPowerRatingSeasons(): Promise<string[]> {
    if (!supabase) return [];
    const result = await supabase
        .from("seasons")
        .select("slug, starts_on")
        .order("starts_on", { ascending: false });
    if (result.error) throw result.error;
    return (result.data as Array<{ slug: string }>).map((row) => row.slug).slice(0, 6);
}

export async function loadPowerRatingRecords(
    season: string
): Promise<PowerRatingRecord[]> {
    if (!supabase) {
        return [];
    }

    const result = await supabase
        .from("spi_results")
        .select(
            "power_rating, weapon, seasons!inner(slug), programs!inner(legacy_team_id, gender, schools!inner(name))"
        )
        .eq("seasons.slug", season);

    if (result.error) throw result.error;

    type DatabaseRating = {
        power_rating: number | null;
        weapon: Weapon;
        programs:
            | { legacy_team_id: number; gender: Gender; schools: { name: string } | Array<{ name: string }> }
            | Array<{ legacy_team_id: number; gender: Gender; schools: { name: string } | Array<{ name: string }> }>;
    };

    return (result.data as unknown as DatabaseRating[]).flatMap((row) => {
        if (row.power_rating == null) return [];
        const program = Array.isArray(row.programs) ? row.programs[0] : row.programs;
        const school = program && (Array.isArray(program.schools) ? program.schools[0] : program.schools);
        if (!program || !school) return [];
        return [{
            teamId: Number(program.legacy_team_id),
            teamName: school.name,
            gender: program.gender,
            weapon: row.weapon,
            calculatedPowerRating: Number(row.power_rating),
        } satisfies PowerRatingRecord];
    });
}

export async function parseFencerRatingFile(file: File): Promise<FencerRatingUploadRow[]> {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error(`${file.name} does not contain a worksheet.`);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
        defval: "",
    });
    return normalizeFencerRatingUploadRows(rows);
}

export function normalizeFencerRatingUploadRows(
    rows: Array<Record<string, unknown>>
): FencerRatingUploadRow[] {
    if (rows.length === 0) throw new Error("The fencer-rating file has no data rows.");

    return rows.map((row, index) => {
        const normalized = new Map(
            Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
        );
        const teamName = cleanCell(readAlias(normalized, ["teamname", "schoolname", "school", "team"]));
        const weaponValue = cleanCell(readAlias(normalized, ["weapon"]));
        const ratingValue = readAlias(normalized, ["powerrating", "rating", "pr"]);
        const rowNumber = index + 2;

        if (!teamName) throw new Error(`Row ${rowNumber} is missing a team name.`);
        if (!weaponValue) throw new Error(`Row ${rowNumber} is missing a weapon.`);
        if (ratingValue === undefined || cleanCell(ratingValue) === "") {
            throw new Error(`Row ${rowNumber} is missing a power rating.`);
        }

        const weapon = normalizeWeapon(weaponValue);
        const powerRating = Number(cleanCell(ratingValue));
        if (!Number.isFinite(powerRating) || powerRating < 0) {
            throw new Error(`Row ${rowNumber} has an invalid power rating.`);
        }

        return { teamName, weapon, powerRating };
    });
}

export async function recalculatePowerRatings(
    season: string,
    gender: Gender,
    rows: FencerRatingUploadRow[],
    sourceFile: string
): Promise<void> {
    if (!supabase) throw new Error("Supabase is not configured.");
    const result = await supabase.rpc("replace_fencer_ratings_and_recalculate", {
        p_season_slug: season,
        p_gender: gender,
        p_rows: rows.map((row) => ({
            team_name: row.teamName,
            weapon: row.weapon,
            power_rating: row.powerRating,
        })),
        p_source_file: sourceFile,
    });
    if (result.error) throw result.error;
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

function normalizeHeader(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readAlias(
    row: Map<string, unknown>,
    aliases: string[]
): unknown {
    for (const alias of aliases) {
        if (row.has(alias)) return row.get(alias);
    }
    return undefined;
}

function cleanCell(value: unknown): string {
    return String(value ?? "")
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .trim();
}

function normalizeWeapon(value: string): Exclude<Weapon, "Team"> {
    const normalized = value.trim().toLowerCase();
    if (normalized === "epee" || normalized === "épée") return "Epee";
    if (normalized === "foil") return "Foil";
    if (normalized === "sabre" || normalized === "saber") return "Sabre";
    throw new Error(`Invalid weapon: ${value}`);
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
