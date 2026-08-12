import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import PollResultsTable from '../../components/polls/PollResultsTable';
import PollShell from '../../components/polls/PollShell';
import { createPollResultsCsv, downloadCsv } from '../../lib/pollCsv';
import { loadPublicPollResults } from '../../lib/pollRepository';
import type { PollCategoryResults } from '../../types/polls';
import './Polls.css';

export default function PublicPollResultsPage({ periodId }: { periodId: string }) {
    const [results, setResults] = useState<PollCategoryResults[]>([]);
    const [selected, setSelected] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { loadPublicPollResults(periodId).then((rows) => { setResults(rows); setSelected(rows[0]?.definitionId ?? ''); setLoaded(true); }).catch((reason) => { setError(reason instanceof Error ? reason.message : 'Could not load published results.'); setLoaded(true); }); }, [periodId]);
    const current = results.find((item) => item.definitionId === selected);
    return <PollShell title="Published Coaches Poll" actions={current && <button className="button secondary" onClick={() => downloadCsv(`${current.category.slug}-results.csv`, createPollResultsCsv(current.standings))}><Download size={17} /> Download</button>}>
        {error && <p className="form-message">{error}</p>}
        {current ? <><label className="poll-category-select">Category<select value={selected} onChange={(event) => setSelected(event.target.value)}>{results.map((item) => <option key={item.definitionId} value={item.definitionId}>{item.category.label}</option>)}</select></label><PollResultsTable rows={current.standings} /></> : loaded && !error ? <div className="empty-state"><h2>No published results</h2></div> : !loaded && <div className="page-loading">Loading published results</div>}
    </PollShell>;
}
