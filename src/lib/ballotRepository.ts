import type { BallotDefinition, BallotRanking, BallotState, BallotStatus, CommitteeBallot, PollScope } from "../types/platform";
import { createBallotDefinitions, readBallot, readLocalBallotStatus, saveBallot, saveLocalBallotStatus } from "./platformData";
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
    return (await getBallotState(definitionId, userId)).rankings;
}

export async function getBallotState(definitionId: string, userId: string): Promise<BallotState> {
    if (!supabase) return { ballotId: null, status: readLocalBallotStatus(definitionId, userId) as BallotStatus, rankings: readBallot(definitionId, userId) };
    const ballot = await supabase.from("ballots").select("id, status").eq("definition_id", definitionId).eq("voter_id", userId).maybeSingle();
    if (ballot.error) throw ballot.error;
    if (!ballot.data) return { ballotId: null, status: "draft", rankings: [] };
    const rankings = await supabase.from("ballot_rankings").select("program_id, rank, programs!inner(legacy_team_id)").eq("ballot_id", ballot.data.id).order("rank");
    if (rankings.error) throw rankings.error;
    return { ballotId: ballot.data.id, status: ballot.data.status as BallotStatus, rankings: (rankings.data ?? []).map((row) => {
        const program = Array.isArray(row.programs) ? row.programs[0] : row.programs;
        return { teamId: Number(program.legacy_team_id), rank: row.rank };
    }) };
}

export async function saveBallotDraft(definitionId: string, userId: string, rankings: BallotRanking[]) {
    if (!supabase) {
        if (readLocalBallotStatus(definitionId, userId) === "submitted") throw new Error("This ballot has already been submitted.");
        saveBallot(definitionId, userId, rankings);
        return;
    }
    const existing = await supabase.from("ballots").select("id, status").eq("definition_id", definitionId).eq("voter_id", userId).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.status === "submitted") throw new Error("This ballot has already been submitted.");
    const ballot = existing.data
        ? await supabase.from("ballots").update({ updated_at: new Date().toISOString() }).eq("id", existing.data.id).select("id").single()
        : await supabase.from("ballots").insert({ definition_id: definitionId, voter_id: userId, status: "draft" }).select("id").single();
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
    if (!supabase) { definitionIds.forEach((definitionId) => saveLocalBallotStatus(definitionId, userId, "submitted")); return; }
    for (const definitionId of definitionIds) {
        const ballot = await supabase.from("ballots").select("id").eq("definition_id", definitionId).eq("voter_id", userId).single();
        if (ballot.error) throw ballot.error;
        const submitted = await supabase.rpc("submit_ballot", { target_ballot: ballot.data.id });
        if (submitted.error) throw submitted.error;
    }
}

export async function getCommitteeBallots(definitions: Array<{ id: string; scope: PollScope }>): Promise<CommitteeBallot[]> {
    if (!supabase || !definitions.length) return [];
    const scopes = new Map(definitions.map((definition) => [definition.id, definition.scope]));
    const result = await supabase
        .from("ballots")
        .select("id, definition_id, status, profiles!ballots_voter_id_fkey(display_name), ballot_rankings(rank, programs!inner(legacy_team_id))")
        .in("definition_id", definitions.map((definition) => definition.id))
        .eq("status", "submitted");
    if (result.error) throw result.error;
    return (result.data ?? []).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
            ballotId: row.id,
            voterName: profile?.display_name ?? "Committee voter",
            scope: scopes.get(row.definition_id)!,
            status: row.status as BallotStatus,
            rankings: (row.ballot_rankings ?? []).map((ranking) => {
                const program = Array.isArray(ranking.programs) ? ranking.programs[0] : ranking.programs;
                return { rank: ranking.rank, teamId: Number(program.legacy_team_id) };
            }).sort((a, b) => a.rank - b.rank),
        };
    });
}

function capitalize(value: string) { return `${value[0].toUpperCase()}${value.slice(1)}`; }
