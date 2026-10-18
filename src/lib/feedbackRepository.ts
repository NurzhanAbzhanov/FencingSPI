import { supabase } from "./supabase";

export type FeedbackContext = { pageUrl: string; season: string; filters?: Record<string, string> };
export type FeedbackKind = "problem" | "suggestion" | "other";
export type FeedbackStatus = "new" | "in_progress" | "resolved";
export type FeedbackSubmission = {
    requestId: string; clientId: string; kind: FeedbackKind; message: string; email: string;
    screenshot: string | null; context: FeedbackContext; website: string;
};
export type FeedbackEntry = {
    id: string; created_at: string; kind: FeedbackKind; message: string; email: string | null;
    context: FeedbackContext; status: FeedbackStatus; has_screenshot: boolean;
};

export function safeFeedbackPageUrl(value: string): string {
    const url = new URL(value);
    const route = url.hash.split("?")[0];
    const safeRoute = /^#\/(spi|team-spi|squad-spi|polls|admin|enter-results|sign-in|set-password|schools)(\/[a-zA-Z0-9-]+)*$/.test(route) ? route : "";
    return `${url.origin}${url.pathname}${safeRoute}`;
}

export function feedbackClientId(): string {
    try {
        const existing = localStorage.getItem("feedback-client");
        if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
        const id = crypto.randomUUID();
        localStorage.setItem("feedback-client", id);
        return id;
    } catch { return crypto.randomUUID(); }
}

export async function submitFeedback(value: FeedbackSubmission): Promise<void> {
    if (!supabase) throw new Error("Feedback is temporarily unavailable. Please try again later.");
    const { error } = await supabase.rpc("submit_site_feedback", {
        p_request_id: value.requestId, p_client_id: value.clientId, p_kind: value.kind,
        p_message: value.message.trim(), p_email: value.email.trim() || null,
        p_context: value.context, p_screenshot: value.screenshot, p_website: value.website,
    });
    if (error) throw new Error(error.code === "P0001" ? error.message : "Your feedback could not be sent. Please try again.");
}

export async function loadFeedback(offset = 0): Promise<FeedbackEntry[]> {
    if (!supabase) throw new Error("Feedback requires a database connection.");
    const { data, error } = await supabase.from("site_feedback")
        .select("id,created_at,kind,message,email,context,status,has_screenshot")
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 49);
    if (error) throw new Error("Could not load feedback. Please retry.");
    return data as FeedbackEntry[];
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
    if (!supabase) throw new Error("Feedback requires a database connection.");
    const { data, error } = await supabase.from("site_feedback").update({ status }).eq("id", id).select("id").single();
    if (error || !data) throw new Error("Could not update feedback status. Please retry.");
}

export async function loadFeedbackScreenshot(id: string): Promise<string | null> {
    if (!supabase) throw new Error("Feedback requires a database connection.");
    const { data, error } = await supabase.from("site_feedback").select("screenshot").eq("id", id).single();
    if (error) throw new Error("Could not load the screenshot.");
    return data.screenshot;
}

export async function prepareFeedbackScreenshot(file: File): Promise<string> {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
        throw new Error("Choose a PNG, JPEG or WebP image smaller than 10 MB.");
    }
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not prepare this image.");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        // Re-encoding removes original file metadata and bounds private attachment storage.
        const image = canvas.toDataURL("image/jpeg", 0.75);
        if (image.length > 700000) throw new Error("This screenshot is too large. Crop it and try again.");
        return image;
    } finally { bitmap.close(); }
}
