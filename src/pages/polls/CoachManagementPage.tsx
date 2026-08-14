import { Save, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import PollShell from '../../components/polls/PollShell';
import { loadCommitteeAccess, saveCommitteeAccess } from '../../lib/pollAdminRepository';
import type { CommitteeAccess, CommitteeAccessInput } from '../../types/polls';
import './Polls.css';

const empty: CommitteeAccessInput = { email: '', displayName: '', role: 'coach', canVote: true, active: true };
export default function CoachManagementPage({ embedded }: { embedded?: boolean } = {}) {
    const [rows, setRows] = useState<CommitteeAccess[]>([]); const [form, setForm] = useState(empty); const [message, setMessage] = useState('');
    const load = useCallback(() => loadCommitteeAccess().then(setRows).catch((reason) => setMessage(reason instanceof Error ? reason.message : 'Could not load committee access.')), []);
    useEffect(() => { load(); }, [load]);
    async function save(event: React.FormEvent) { event.preventDefault(); try { await saveCommitteeAccess(form); setForm(empty); setMessage('Access saved. Send a Supabase Auth invitation if this is a new account.'); await load(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not save access.'); } }
    const body = <>
        <form className="committee-form" onSubmit={save}><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Display name<input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label><label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as CommitteeAccessInput['role'] })}><option value="coach">Coach</option><option value="admin">Admin</option></select></label><label className="checkbox-label"><input type="checkbox" checked={form.canVote} onChange={(event) => setForm({ ...form, canVote: event.target.checked })} /> Voting access</label><label className="checkbox-label"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label><button className="button primary"><UserPlus size={17} /> Save access</button></form>
        <p className="help-line">New users also need a Supabase Auth invitation before they can sign in.</p>{message && <p className="form-message" role="status">{message}</p>}
        <div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Voting</th><th>Status</th><th>Account</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.email}><td>{row.displayName}</td><td>{row.email}</td><td>{row.role}</td><td>{row.canVote ? 'Voter' : 'Observer'}</td><td>{row.active ? 'Active' : 'Inactive'}</td><td>{row.linked ? 'Linked' : 'Invitation needed'}</td><td><button className="button secondary" style={{ padding: "4px 10px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "6px" }} title={`Edit ${row.displayName}`} onClick={() => setForm({ email: row.email, displayName: row.displayName, role: row.role, canVote: row.canVote, active: row.active })}><Save size={14} /> Edit</button></td></tr>)}</tbody></table></div>
    </>;
    if (embedded) {
        return <section className="admin-section"><h2>Coaches and Administrators</h2>{body}</section>;
    }
    return <PollShell title="Coaches and Administrators" backHref="#/admin">{body}</PollShell>;
}
