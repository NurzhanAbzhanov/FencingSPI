import type { PollMonth, Program } from "../types/platform";
import { addLocalProgram } from "./platformData";
import { supabase } from "./supabase";

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
