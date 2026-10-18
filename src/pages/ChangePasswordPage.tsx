import { KeyRound } from "lucide-react";
import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ChangePasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [message, setMessage] = useState("");
    const pending = useRef(false);

    async function changePassword(event: React.FormEvent) {
        event.preventDefault();
        if (pending.current) return;
        setSuccess(false);
        if (password.length < 8) return setMessage("Use at least 8 characters.");
        if (password !== confirmation) return setMessage("Passwords do not match.");
        if (!supabase) return setMessage("Password changes are unavailable in demo mode.");
        pending.current = true;
        setSaving(true);
        setMessage("");
        try {
            const { data, error: sessionError } = await supabase.auth.getUser();
            if (sessionError || !data.user) throw new Error("Your session has expired. Sign in again to change your password.");
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setPassword("");
            setConfirmation("");
            setSuccess(true);
            setMessage("Password changed. Use your new password the next time you sign in.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not change your password. Please try again.");
        } finally {
            pending.current = false;
            setSaving(false);
        }
    }

    return <section className="auth-page"><div className="auth-panel"><h1>Change password</h1>
        <form className="stack-form" onSubmit={changePassword}>
            <label>New password<input type="password" autoComplete="new-password" minLength={8} required disabled={saving} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required disabled={saving} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <button className="button primary" disabled={saving}><KeyRound size={17} />{saving ? "Changing password..." : "Change password"}</button>
            {message && <p role={success ? "status" : "alert"} className={`form-message${success ? "" : " error"}`}>{message}</p>}
            <a href="#/polls">Back to Coaches Poll</a>
        </form>
    </div></section>;
}
