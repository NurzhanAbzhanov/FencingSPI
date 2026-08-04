import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const initialAuthType = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type");
const requestedPasswordSetup = new URLSearchParams(window.location.search).get("setup-password") === "1";

export const isInitialPasswordSetup = initialAuthType === "invite" || initialAuthType === "recovery" || requestedPasswordSetup;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseKey)
    : null;
