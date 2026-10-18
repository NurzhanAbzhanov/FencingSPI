import { useState } from "react";
import { loadSidRegistrations, type SidRegistration } from "../lib/sidRepository";

export default function SidRegistrations() {
    const [rows, setRows] = useState<SidRegistration[]>([]);
    const [busy, setBusy] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [more, setMore] = useState(false);
    const [error, setError] = useState("");
    async function load(append = false) {
        setBusy(true); setError("");
        try {
            const data = await loadSidRegistrations(append ? rows.length : 0);
            setRows((current) => append ? [...current, ...data.filter((row) => !current.some((existing) => existing.id === row.id))] : data);
            setMore(data.length === 50); setLoaded(true);
        } catch (err) { setError(err instanceof Error ? err.message : "Could not load registrations."); }
        finally { setBusy(false); }
    }
    return <section className="admin-section">
        <div className="page-title-row"><h2>SID registrations</h2><button className="button secondary" disabled={busy} onClick={() => void load()}>{busy ? "Loading..." : loaded ? "Refresh registrations" : "Load registrations"}</button></div>
        {error && <p role="alert">{error}</p>}
        {loaded && !rows.length && <p>No SID registrations yet.</p>}
        {!!rows.length && <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>Name</th><th>School</th><th>Email</th><th>Registered</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.school}</td><td><a href={`mailto:${row.email}`}>{row.email}</a></td><td>{new Date(row.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
        {more && <button className="button secondary" disabled={busy} onClick={() => void load(true)}>Load more</button>}
    </section>;
}
