import { CheckCircle2, Play, Send, StopCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import PollShell from '../../components/polls/PollShell';
import { closePoll, loadPollPeriods, openPoll, publishPoll, schedulePoll } from '../../lib/pollAdminRepository';
import type { PollPeriodAdmin } from '../../types/polls';
import './Polls.css';

export default function PollManagementPage({ season }: { season: string }) {
    const [periods, setPeriods] = useState<PollPeriodAdmin[]>([]);
    const [error, setError] = useState('');
    const load = useCallback(() => loadPollPeriods(season).then(setPeriods).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load polls.')), [season]);
    useEffect(() => { load(); }, [load]);
    async function act(label: string, action: () => Promise<void>) { if (!window.confirm(`${label}?`)) return; setError(''); try { await action(); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Poll action failed.'); } }
    return <PollShell title="Poll Management" backHref="#/admin">
        {error && <p className="form-message">{error}</p>}
        <div className="poll-management-list">{periods.map((period) => <section className="poll-management-row" key={period.id}><div><h2>{period.label}</h2><span className={`poll-status ${period.status}`}>{period.status}</span></div><ScheduleFields period={period} onSave={async (opensAt, closesAt) => { try { await schedulePoll({ periodId: period.id, opensAt, closesAt }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Schedule failed.'); } }} /><p>Snapshot: {period.snapshotCapturedAt ? new Date(period.snapshotCapturedAt).toLocaleString() : 'Not captured'}</p><div className="poll-state-actions">{period.status === 'draft' && <button className="button primary" onClick={() => act('Open this poll', () => openPoll(period.id))}><Play size={16} /> Open poll</button>}{period.status === 'open' && <button className="button secondary" onClick={() => act('Close this poll', () => closePoll(period.id))}><StopCircle size={16} /> Close poll</button>}{period.status === 'closed' && <button className="button primary" onClick={() => act('Publish these results', () => publishPoll(period.id))}><Send size={16} /> Publish</button>}{period.status === 'published' && <span className="published-state"><CheckCircle2 size={17} /> Published</span>}</div></section>)}</div>
    </PollShell>;
}

function ScheduleFields({ period, onSave }: { period: PollPeriodAdmin; onSave: (opensAt: string | null, closesAt: string | null) => Promise<void> }) {
    const [opensAt, setOpensAt] = useState(toLocal(period.opensAt)); const [closesAt, setClosesAt] = useState(toLocal(period.closesAt));
    return <div className="schedule-fields"><label>Opens<input type="datetime-local" value={opensAt} disabled={period.status !== 'draft'} onChange={(event) => setOpensAt(event.target.value)} /></label><label>Closes<input type="datetime-local" value={closesAt} disabled={period.status !== 'draft'} onChange={(event) => setClosesAt(event.target.value)} /></label>{period.status === 'draft' && <button className="button secondary compact" onClick={() => onSave(iso(opensAt), iso(closesAt))}>Save schedule</button>}</div>;
}
function toLocal(value: string | null) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function iso(value: string) { return value ? new Date(value).toISOString() : null; }
