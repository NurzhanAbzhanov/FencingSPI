import { CheckCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { feedbackClientId, prepareFeedbackScreenshot, submitFeedback } from "../lib/feedbackRepository";
import type { FeedbackContext, FeedbackKind } from "../lib/feedbackRepository";
import "./Feedback.css";

export default function FeedbackDialog({ context, onClose }: { context: FeedbackContext; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const sending = useRef(false);
    const [requestId] = useState(() => crypto.randomUUID());
    const [clientId] = useState(feedbackClientId);
    const [kind, setKind] = useState<FeedbackKind>("problem");
    const [message, setMessage] = useState("");
    const [email, setEmail] = useState("");
    const [website, setWebsite] = useState("");
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [imageBusy, setImageBusy] = useState(false);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");
    const [imageError, setImageError] = useState("");
    useEffect(() => {
        const element = dialog.current!;
        const focused = document.activeElement as HTMLElement | null;
        element.showModal();
        return () => { element.close(); focused?.focus(); };
    }, []);

    async function send(event: React.FormEvent) {
        event.preventDefault();
        if (sending.current || imageBusy) return;
        if (message.trim().length < 10) { setError("Please include at least 10 characters of feedback."); return; }
        sending.current = true;
        setBusy(true); setError("");
        try {
            await submitFeedback({ requestId, clientId, kind, message, email, context, screenshot, website });
            setDone(true);
        } catch (err) { setError(err instanceof Error ? err.message : "Could not send feedback. Please retry."); }
        finally { sending.current = false; setBusy(false); }
    }

    async function attach(file?: File) {
        setScreenshot(null); setImageError("");
        if (!file) return;
        setImageBusy(true);
        try { setScreenshot(await prepareFeedbackScreenshot(file)); }
        catch (err) { setImageError(err instanceof Error ? err.message : "Could not open this screenshot."); }
        finally { setImageBusy(false); }
    }

    return <dialog className="feedback-dialog" ref={dialog} aria-labelledby="feedback-title"
        onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
        <div className="feedback-heading"><h2 id="feedback-title">{done ? "Feedback received" : "Give Feedback"}</h2>
            <button type="button" className="feedback-close" aria-label="Close feedback" title="Close feedback" disabled={busy} onClick={onClose}><X size={20} /></button></div>
        {done ? <div className="feedback-success" role="status"><CheckCircle size={32} /><p>Thank you for helping us improve NCAA Fencing.</p>
            <button type="button" className="button primary" onClick={onClose}>Done</button></div> :
            <form onSubmit={send} className="feedback-form">
                <fieldset disabled={busy} className="feedback-fields">
                    <label>Feedback type<select value={kind} onChange={(event) => setKind(event.target.value as FeedbackKind)}>
                        <option value="problem">Report a problem</option><option value="suggestion">Suggest an improvement</option><option value="other">Something else</option>
                    </select></label>
                    <label>Your feedback<textarea required minLength={10} maxLength={4000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)}
                        placeholder={kind === "problem" ? "What happened, and what did you expect? For data issues, include the school and season." : kind === "suggestion" ? "What would you change, and how would it help you?" : "What would you like us to know?"} /></label>
                    <label>Email (optional)<input type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="For a follow-up" /></label>
                    <label>Screenshot (optional)<input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={imageBusy} onChange={(event) => void attach(event.target.files?.[0])} /></label>
                    {imageBusy && <p role="status">Preparing screenshot...</p>}
                    {imageError && <p className="feedback-error" role="alert">{imageError}</p>}
                    {screenshot && <div className="feedback-attachment"><img src={screenshot} alt="Screenshot to attach" /><button type="button" className="button secondary" onClick={() => { setScreenshot(null); if (fileInput.current) fileInput.current.value = ""; }}>Remove screenshot</button></div>}
                    <label className="feedback-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
                </fieldset>
                <details className="feedback-context"><summary>Page details included</summary><p>{context.pageUrl}</p><p>Season: {context.season}</p>
                    {context.filters && <dl>{Object.entries(context.filters).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}</details>
                <p className="feedback-privacy">Only site administrators can read your feedback. Please leave out passwords and sensitive personal information.</p>
                {error && <p className="feedback-error" role="alert">{error}</p>}
                <button className="button primary feedback-submit" disabled={busy || imageBusy}><Send size={17} />{busy ? "Sending..." : "Send feedback"}</button>
            </form>}
    </dialog>;
}
