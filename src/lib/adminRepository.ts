import type { PollMonth, Program, SubmittedBallotSummary } from "../types/platform";
import { addLocalProgram } from "./platformData";
import { supabase } from "./supabase";

export async function loadCommitteeCounts(): Promise<{ admins: number; voters: number }> {
    if (!supabase) return { admins: 0, voters: 0 };

    const [admins, voters] = await Promise.all([
        supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("active", true)
            .eq("role", "admin"),
        supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("active", true)
            .eq("can_vote", true),
    ]);

    if (admins.error) throw admins.error;
    if (voters.error) throw voters.error;
    return { admins: admins.count ?? 0, voters: voters.count ?? 0 };
}

export async function createProgram(program: Program) {
    if (!supabase) { addLocalProgram(program); return; }
    const season = await supabase.from("seasons").select("id").eq("is_active", true).single();
    if (season.error) throw season.error;
    const school = await supabase.from("schools").insert({ id: program.id, name: program.name, logo_url: program.logoUrl, conference: program.conference, region: program.region }).select("id").single();
    if (school.error) throw school.error;
    const createdProgram = await supabase.from("programs").insert({ school_id: school.data.id, legacy_team_id: program.id, gender: program.gender }).select("id").single();
    if (createdProgram.error) throw createdProgram.error;
    const programSeason = await supabase.from("program_seasons").insert({ season_id: season.data.id, program_id: createdProgram.data.id, division: Number(program.division), conference: program.conference, region: program.region });
    if (programSeason.error) throw programSeason.error;
}

export async function savePollSchedule(periods: Array<{ month: PollMonth; status: string }>) {
    if (!supabase) { localStorage.setItem("spi-demo-poll-schedule", JSON.stringify(periods)); return; }
    const season = await supabase.from("seasons").select("id").eq("is_active", true).single();
    if (season.error) throw season.error;
    for (const period of periods) {
        const monthNumber = period.month === "October" ? 10 : period.month === "November" ? 11 : period.month === "December" ? 12 : 1;
        const label = period.month === "October" ? "October (Preseason)" : period.month;
        const record = await supabase.from("poll_periods").upsert({ season_id: season.data.id, month: monthNumber, label, status: period.status.toLowerCase() }, { onConflict: "season_id,month" }).select("id").single();
        if (record.error) throw record.error;
        const initialized = await supabase.rpc("initialize_poll_period", { target_period: record.data.id });
        if (initialized.error) throw initialized.error;
        if (period.status === "Published") {
            const published = await supabase.rpc("publish_poll_period", { target_period: record.data.id });
            if (published.error) throw published.error;
        }
    }
}

export async function loadSubmittedBallots(): Promise<SubmittedBallotSummary[]> {
    if (!supabase) return [];
    const result = await supabase
        .from("ballots")
        .select("id, submitted_at, profiles!ballots_voter_id_fkey(display_name), ballot_definitions!inner(gender, weapon, scope, poll_periods!inner(label))")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });
    if (result.error) throw result.error;
    return (result.data ?? []).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const definition = Array.isArray(row.ballot_definitions) ? row.ballot_definitions[0] : row.ballot_definitions;
        const period = Array.isArray(definition.poll_periods) ? definition.poll_periods[0] : definition.poll_periods;
        return {
            ballotId: row.id,
            voterName: profile?.display_name ?? "Committee voter",
            month: (period.label.startsWith("October") ? "October" : period.label) as SubmittedBallotSummary["month"],
            gender: definition.gender,
            weapon: definition.weapon,
            scope: definition.scope,
            submittedAt: row.submitted_at,
        };
    });
}

export async function reopenSubmittedBallot(ballotId: string) {
    if (!supabase) return;
    const result = await supabase.rpc("reopen_ballot", { target_ballot: ballotId });
    if (result.error) throw result.error;
}
