import type { BallotDefinition, BallotRanking } from "../types/platform";
import { createBallotDefinitions, readBallot, saveBallot } from "./platformData";
import { supabase } from "./supabase";
import type { Program } from "../types/platform";

export async function getBallotDefinitions(programs: Program[]): Promise<BallotDefinition[]> {
    if (!supabase) return createBallotDefinitions(programs);
    const { data, error } = await supabase.from("ballot_definitions").select("id, gender, weapon, scope, rank_limit, poll_periods!inner(label, status)");
    if (error || !data?.length) return createBallotDefinitions(programs);
    return data.map((row) => {
        const period = Array.isArray(row.poll_periods) ? row.poll_periods[0] : row.poll_periods;
        const label = period.label.startsWith("October") ? "October" : period.label;
        return { id: row.id, month: label, gender: row.gender, weapon: row.weapon, scope: row.scope, rankLimit: row.rank_limit, status: capitalize(period.status) } as BallotDefinition;
    });
}

export async function getBallotRankings(definitionId: string, userId: string): Promise<BallotRanking[]> {
    if (!supabase) return readBallot(definitionId, userId);
    const ballot = await supabase.from("ballots").select("id").eq("definition_id", definitionId).eq("voter_id", userId).maybeSingle();
    if (!ballot.data) return [];
    const rankings = await supabase.from("ballot_rankings").select("program_id, rank, programs!inner(legacy_team_id)").eq("ballot_id", ballot.data.id).order("rank");
    if (rankings.error) throw rankings.error;
    return (rankings.data ?? []).map((row) => {
        const program = Array.isArray(row.programs) ? row.programs[0] : row.programs;
        return { teamId: Number(program.legacy_team_id), rank: row.rank };
    });
}

export async function saveBallotDraft(definitionId: string, userId: string, rankings: BallotRanking[]) {
    if (!supabase) { saveBallot(definitionId, userId, rankings); return; }
    const ballot = await supabase.from("ballots").upsert({ definition_id: definitionId, voter_id: userId, status: "draft", updated_at: new Date().toISOString() }, { onConflict: "definition_id,voter_id" }).select("id").single();
    if (ballot.error) throw ballot.error;
    const deleted = await supabase.from("ballot_rankings").delete().eq("ballot_id", ballot.data.id);
    if (deleted.error) throw deleted.error;
    if (!rankings.length) return;
    const programs = await supabase.from("programs").select("id, legacy_team_id").in("legacy_team_id", rankings.map((ranking) => ranking.teamId));
    if (programs.error) throw programs.error;
    const programIds = new Map((programs.data ?? []).map((program) => [Number(program.legacy_team_id), program.id]));
    const inserted = await supabase.from("ballot_rankings").insert(rankings.map((ranking) => {
        const programId = programIds.get(ranking.teamId);
        if (!programId) throw new Error(`Program ${ranking.teamId} is not loaded in Supabase.`);
        return { ballot_id: ballot.data.id, program_id: programId, rank: ranking.rank };
    }));
    if (inserted.error) throw inserted.error;
}

export async function submitBallots(definitionIds: string[], userId: string) {
    if (!supabase) return;
    for (const definitionId of definitionIds) {
        const ballot = await supabase.from("ballots").select("id").eq("definition_id", definitionId).eq("voter_id", userId).single();
        if (ballot.error) throw ballot.error;
        const submitted = await supabase.rpc("submit_ballot", { target_ballot: ballot.data.id });
        if (submitted.error) throw submitted.error;
    }
}

function capitalize(value: string) { return `${value[0].toUpperCase()}${value.slice(1)}`; }
