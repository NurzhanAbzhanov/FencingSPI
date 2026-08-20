import type { Program } from "../types/platform";
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
    const programSeason = await supabase.from("program_seasons").insert({ season_id: season.data.id, program_id: createdProgram.data.id, division: Number(program.division), conference: program.conference, region: program.region }).select("id").single();
    if (programSeason.error) throw programSeason.error;
    const memberships = await supabase.from("program_season_conferences").insert(program.conferences.map((conference) => ({ program_season_id: programSeason.data.id, conference })));
    if (memberships.error) throw memberships.error;
}
