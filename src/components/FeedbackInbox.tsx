import { useEffect, useState } from "react";
import { loadFeedback, loadFeedbackScreenshot, updateFeedbackStatus } from "../lib/feedbackRepository";
import type { FeedbackEntry, FeedbackStatus } from "../lib/feedbackRepository";
import "./Feedback.css";

const kindLabels = { problem: "Problem", suggestion: "Suggestion", other: "Other feedback" };

export default function FeedbackInbox() {
    const [entries, setEntries] = useState<FeedbackEntry[]>([]);
    const [busy, setBusy] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState("");
    async function refresh(append = false) {
        setBusy(true); setError("");
        try {
            const data = await loadFeedback(append ? entries.length : 0);
            setEntries((current) => append ? [...current, ...data.filter((row) => !current.some((entry) => entry.id === row.id))] : data);
            setHasMore(data.length === 50); setLoaded(true);
        } catch (err) { setError(err instanceof Error ? err.message : "Could not load feedback."); }
        finally { setBusy(false); }
    }
    // Load on demand so opening Admin does not download private feedback automatically.
    return <section className="admin-section feedback-inbox">
        <div className="page-title-row"><h2>Feedback inbox</h2><button className="button secondary" disabled={busy} onClick={() => void refresh()}>{busy ? "Loading..." : loaded ? "Refresh feedback" : "Load feedback"}</button></div>
        {error && <p className="feedback-error" role="alert">{error}</p>}
        {loaded && entries.length === 0 && <p>No feedback yet.</p>}
        <ul className="feedback-list">{entries.map((entry) => <FeedbackItem key={entry.id} entry={entry} onStatusChange={(status) => setEntries((current) => current.map((row) => row.id === entry.id ? { ...row, status } : row))} />)}</ul>
        {hasMore && <button className="button secondary" disabled={busy} onClick={() => void refresh(true)}>Load more</button>}
    </section>;
}

function FeedbackItem({ entry, onStatusChange }: { entry: FeedbackEntry; onStatusChange: (status: FeedbackStatus) => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [showScreenshot, setShowScreenshot] = useState(false);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [imageError, setImageError] = useState("");
    useEffect(() => {
        if (!showScreenshot) return;
        let active = true;
        loadFeedbackScreenshot(entry.id).then((data) => { if (active) setScreenshot(data); })
            .catch((err) => { if (active) setImageError(err.message); });
        return () => { active = false; };
    }, [entry.id, showScreenshot]);
    async function changeStatus(status: FeedbackStatus) {
        setBusy(true); setError("");
        try { await updateFeedbackStatus(entry.id, status); onStatusChange(status); }
        catch (err) { setError(err instanceof Error ? err.message : "Could not update status."); }
        finally { setBusy(false); }
    }
    return <li>
        <div className="feedback-item-heading"><strong>{kindLabels[entry.kind]}</strong><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>
            <label>Status<select disabled={busy} value={entry.status} onChange={(event) => void changeStatus(event.target.value as FeedbackStatus)}>
                <option value="new">New</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option>
            </select></label></div>
        <p className="feedback-message">{entry.message}</p>
        {entry.email && <p>Reply to: <a href={`mailto:${entry.email}`}>{entry.email}</a></p>}
        <details className="feedback-context"><summary>Page and filters</summary><p>{entry.context.pageUrl}</p><p>Season: {entry.context.season}</p>
            {Object.entries(entry.context.filters ?? {}).map(([key, value]) => <p key={key}>{key}: {value}</p>)}</details>
        {entry.has_screenshot && <button className="button secondary" onClick={() => { setImageError(""); setShowScreenshot(!showScreenshot); }}>{showScreenshot ? "Hide screenshot" : "View screenshot"}</button>}
        {showScreenshot && (imageError ? <p role="alert">{imageError}</p> : screenshot ? <img src={screenshot} alt="Submitted screenshot" /> : <p role="status">Loading screenshot...</p>)}
        {error && <p className="feedback-error" role="alert">{error}</p>}
    </li>;
}
