import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import PollShell from '../../components/polls/PollShell';
import { createParticipationCsv, downloadCsv } from '../../lib/pollCsv';
import { POLL_CATEGORY_SPECS } from '../../lib/pollDomain';
import { loadParticipation, loadPollPeriods } from '../../lib/pollAdminRepository';
import type { PollParticipationRow } from '../../types/polls';
import './Polls.css';

const categories = POLL_CATEGORY_SPECS.filter((item) => !item.hidden);
export default function PollParticipationPage({ periodId, season = '2025-26' }: { periodId: string; season?: string }) {
    const [rows, setRows] = useState<PollParticipationRow[]>([]); const [error, setError] = useState('');
    const [currentPeriodId, setCurrentPeriodId] = useState('');
    const resolvedPeriodId = periodId === 'current' ? currentPeriodId : periodId;
    useEffect(() => {
        if (periodId !== 'current') return;
        loadPollPeriods(season).then((periods) => {
            const current = periods.find((period) => period.effectivelyOpen) ?? periods.find((period) => period.status === 'closed') ?? periods.find((period) => period.status === 'published') ?? periods[0];
            if (!current) throw new Error('No poll period is available.');
            setCurrentPeriodId(current.id);
        }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not resolve the current poll.'));
    }, [periodId, season]);
    useEffect(() => { if (resolvedPeriodId) loadParticipation(resolvedPeriodId).then(setRows).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load participation.')); }, [resolvedPeriodId]);
    const submitted = useMemo(() => rows.reduce((sum, row) => sum + Object.values(row.statuses).filter((status) => status === 'submitted').length, 0), [rows]);
    function download() { downloadCsv(`poll-participation-${resolvedPeriodId || periodId}.csv`, createParticipationCsv(['Coach', 'Email', ...categories.map((item) => item.label)], rows.map((row) => [row.voterName, row.email, ...categories.map((item) => label(row.statuses[item.slug] ?? 'not_started'))]))); }
    return <PollShell title="Poll Participation" backHref="#/admin" actions={<button className="button secondary" onClick={download}><Download size={17} /> Download</button>}>
        <p className="participation-summary">{submitted} submitted ballots across {rows.length} voters</p>{error && <p className="form-message">{error}</p>}
        <div className="platform-table-wrap"><table className="platform-table participation-table"><thead><tr><th>Coach</th>{categories.map((item) => <th key={item.slug}>{item.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.voterId}><td className="school-cell">{row.voterName}</td>{categories.map((item) => <td key={item.slug}><span className={`participation-status ${row.statuses[item.slug] ?? 'not_started'}`}>{label(row.statuses[item.slug] ?? 'not_started')}</span></td>)}</tr>)}</tbody></table></div>
    </PollShell>;
}
function label(value: string) { return value === 'not_started' ? 'Not started' : value[0].toUpperCase() + value.slice(1); }
