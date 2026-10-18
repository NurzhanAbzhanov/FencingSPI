import { CheckCircle, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { registerSid } from "../lib/sidRepository";
import "./Feedback.css";

export default function SidSignupDialog({ schools, onClose }: { schools: string[]; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const sending = useRef(false);
    const [requestId] = useState(() => crypto.randomUUID());
    const [name, setName] = useState("");
    const [school, setSchool] = useState("");
    const [email, setEmail] = useState("");
    const [website, setWebsite] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        const element = dialog.current!;
        const focused = document.activeElement as HTMLElement | null;
        element.showModal();
        return () => { element.close(); focused?.focus(); };
    }, []);
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (sending.current) return;
        if (name.trim().length < 2 || school.trim().length < 2) { setError("Enter your name and school."); return; }
        sending.current = true; setBusy(true); setError("");
        try { await registerSid({ requestId, name, school, email, website }); setDone(true); }
        catch (err) { setError(err instanceof Error ? err.message : "Could not register. Please retry."); }
        finally { sending.current = false; setBusy(false); }
    }
    return <dialog ref={dialog} className="feedback-dialog" aria-labelledby="sid-signup-title"
        onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
        <div className="feedback-heading"><h2 id="sid-signup-title">{done ? "Registration received" : "SID Signup"}</h2>
            <button type="button" className="feedback-close" aria-label="Close SID signup" title="Close SID signup" disabled={busy} onClick={onClose}><X size={20} /></button></div>
        {done ? <div className="feedback-success" role="status"><CheckCircle size={32} /><p>Your Sports Information Director registration has been received.</p><button className="button primary" onClick={onClose}>Done</button></div> :
            <form className="feedback-form" onSubmit={submit}>
                <p className="feedback-privacy">Register your contact details as a Sports Information Director.</p>
                <fieldset className="feedback-fields" disabled={busy}>
                    <label>SID name<input required autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
                    <label>School<input required list="sid-schools" autoComplete="organization" maxLength={200} value={school} onChange={(event) => setSchool(event.target.value)} /></label>
                    <datalist id="sid-schools">{[...new Set(schools)].sort().map((item) => <option key={item} value={item} />)}</datalist>
                    <label>Email<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                    <label className="feedback-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
                </fieldset>
                <p className="feedback-privacy">Only site administrators can view your contact details.</p>
                {error && <p role="alert" className="feedback-error">{error}</p>}
                <button className="button primary feedback-submit" disabled={busy}><UserPlus size={17} />{busy ? "Submitting..." : "Sign up"}</button>
            </form>}
    </dialog>;
}
