import type { Gender, MatchSubmission } from "../types/types";
import { supabase } from "./supabase";

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
    submission_email: string | null;
    created_at: string;
    left_program:
        | { legacy_team_id: number }
        | Array<{ legacy_team_id: number }>;
    right_program:
        | { legacy_team_id: number }
        | Array<{ legacy_team_id: number }>;
};

export async function loadDatabaseMatchSubmissions(
    season: string
): Promise<MatchSubmission[] | null> {
    if (!supabase) return null;

    const auth = await supabase.auth.getUser();
    if (!auth.data.user) return null;

    const result = await supabase
        .from("matches")
        .select(
            "id, source_id, fenced_on, gender, left_sabre, left_foil, left_epee, right_sabre, right_foil, right_epee, host, submission_email, created_at, seasons!inner(slug), left_program:programs!matches_left_program_id_fkey(legacy_team_id), right_program:programs!matches_right_program_id_fkey(legacy_team_id)"
        )
        .eq("seasons.slug", season)
        .order("fenced_on", { ascending: true });

    if (result.error) throw result.error;

    return (result.data as unknown as DatabaseMatch[]).flatMap((row) => {
        const leftProgram = Array.isArray(row.left_program)
            ? row.left_program[0]
            : row.left_program;
        const rightProgram = Array.isArray(row.right_program)
            ? row.right_program[0]
            : row.right_program;

        if (!leftProgram || !rightProgram) return [];

        return [{
            id: Number(row.source_id ?? row.id),
            timestamp: row.created_at,
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
            email: row.submission_email ?? "",
        } satisfies MatchSubmission];
    });
}

export async function saveDatabaseMatchSubmission(
    season: string,
    submission: MatchSubmission
): Promise<void> {
    if (!supabase) return;

    const auth = await supabase.auth.getUser();
    if (!auth.data.user) throw new Error("Sign in as an administrator to save matches.");

    const [seasonResult, programsResult] = await Promise.all([
        supabase.from("seasons").select("id").eq("slug", season).single(),
        supabase
            .from("programs")
            .select("id, legacy_team_id, gender")
            .in("legacy_team_id", [submission.leftTeamId, submission.rightTeamId]),
    ]);

    if (seasonResult.error) throw seasonResult.error;
    if (programsResult.error) throw programsResult.error;

    const programs = programsResult.data.filter(
        (program) => program.gender === submission.gender
    );
    const leftProgram = programs.find(
        (program) => Number(program.legacy_team_id) === submission.leftTeamId
    );
    const rightProgram = programs.find(
        (program) => Number(program.legacy_team_id) === submission.rightTeamId
    );

    if (!leftProgram || !rightProgram) {
        throw new Error("Could not match both teams to Supabase programs.");
    }

    const result = await supabase.from("matches").upsert(
        {
            source_id: submission.id,
            season_id: seasonResult.data.id,
            fenced_on: submission.date,
            gender: submission.gender,
            left_program_id: leftProgram.id,
            right_program_id: rightProgram.id,
            left_sabre: submission.leftSabre,
            left_foil: submission.leftFoil,
            left_epee: submission.leftEpee,
            right_sabre: submission.rightSabre,
            right_foil: submission.rightFoil,
            right_epee: submission.rightEpee,
            host: submission.host,
            submission_email: submission.email || null,
            submitted_by: auth.data.user.id,
        },
        { onConflict: "season_id,source_id" }
    );

    if (result.error) throw result.error;
}

export async function deleteDatabaseMatchSubmission(
    season: string,
    submissionId: number
): Promise<void> {
    if (!supabase) return;

    const auth = await supabase.auth.getUser();
    if (!auth.data.user) throw new Error("Sign in as an administrator to delete matches.");

    const seasonResult = await supabase
        .from("seasons")
        .select("id")
        .eq("slug", season)
        .single();
    if (seasonResult.error) throw seasonResult.error;

    const result = await supabase
        .from("matches")
        .delete()
        .eq("season_id", seasonResult.data.id)
        .eq("source_id", submissionId);

    if (result.error) throw result.error;
}
