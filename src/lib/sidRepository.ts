import { supabase } from "./supabase";

export type SidRegistration = { id: string; name: string; school: string; email: string; created_at: string };

export async function registerSid(value: { requestId: string; name: string; school: string; email: string; website: string }): Promise<void> {
    if (!supabase) throw new Error("SID signup is temporarily unavailable. Please try again later.");
    const { error } = await supabase.rpc("register_sid", {
        p_request_id: value.requestId, p_name: value.name.trim(), p_school: value.school.trim(),
        p_email: value.email.trim(), p_website: value.website,
    });
    if (error) throw new Error(error.code === "P0001" ? error.message : "Your registration could not be sent. Please try again.");
}

export async function loadSidRegistrations(offset = 0): Promise<SidRegistration[]> {
    if (!supabase) throw new Error("SID registrations require a database connection.");
    const { data, error } = await supabase.from("sid_registrations").select("id,name,school,email,created_at")
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 49);
    if (error) throw new Error("Could not load SID registrations. Please retry.");
    return data as SidRegistration[];
}
