import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { PlatformUser } from "../types/platform";

export default function SetPasswordPage({ onCompleted }: { onCompleted: (user: PlatformUser) => void }) {
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [status, setStatus] = useState<"checking" | "ready" | "saving" | "error">(supabase ? "checking" : "error");
    const [message, setMessage] = useState(supabase ? "" : "Supabase is not configured for this deployment.");

    useEffect(() => {
        if (!supabase) return;

        supabase.auth.getSession().then(({ data, error }) => {
            if (error || !data.session) {
                setMessage(error?.message ?? "This invitation is invalid or has expired. Ask an administrator to send a new invitation.");
                setStatus("error");
                return;
            }
            setStatus("ready");
        });
    }, []);

    async function createPassword(event: React.FormEvent) {
        event.preventDefault();
        if (!supabase || status !== "ready") return;
        if (password !== confirmation) return setMessage("Passwords do not match.");

        setStatus("saving");
        setMessage("");
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) {
            setMessage(error.message);
            setStatus("ready");
            return;
        }

        const profile = await supabase.from("profiles").select("display_name, role, can_vote").eq("id", data.user.id).single();
        if (profile.error) {
            setMessage(profile.error.message);
            setStatus("ready");
            return;
        }

        onCompleted({ id: data.user.id, name: profile.data.display_name, role: profile.data.role, canVote: profile.data.can_vote });
    }

    return <section className="auth-page"><div className="auth-panel"><p className="eyebrow">Committee account</p><h1>Create password</h1>
        {status === "checking" ? <p className="auth-status">Validating invitation</p> :
        status === "error" ? <div className="demo-login"><p className="form-message error">{message}</p><a className="button secondary" href="#/sign-in">Return to sign in</a></div> :
        <form onSubmit={createPassword} className="stack-form">
            <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <button className="button primary" disabled={status === "saving"}><KeyRound size={17} /> {status === "saving" ? "Creating password" : "Create password"}</button>
            {message && <p className="form-message error">{message}</p>}
        </form>}
    </div></section>;
}
