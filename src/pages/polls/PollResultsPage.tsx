import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import PollResultsTable from '../../components/polls/PollResultsTable';
import PollShell from '../../components/polls/PollShell';
import { createPollResultsCsv, downloadCsv } from '../../lib/pollCsv';
import { loadIndividualBallots, loadPollResults } from '../../lib/pollRepository';
import type { IndividualPollBallot, PollCategoryResults } from '../../types/polls';
import './Polls.css';

export default function PollResultsPage({ periodId }: { periodId: string }) {
    const [results, setResults] = useState<PollCategoryResults[]>([]);
    const [selected, setSelected] = useState('');
    const [ballots, setBallots] = useState<IndividualPollBallot[]>([]);
    const [error, setError] = useState('');
    useEffect(() => { loadPollResults(periodId).then((loaded) => { setResults(loaded); setSelected(loaded[0]?.definitionId ?? ''); }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load results.')); }, [periodId]);
    useEffect(() => { if (!selected) return; loadIndividualBallots(selected).then(setBallots).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load individual ballots.')); }, [selected]);
    const current = results.find((item) => item.definitionId === selected);
    return <PollShell title="Poll Results" backHref="#/polls" actions={current && <button className="button secondary" onClick={() => downloadCsv(`${current.category.slug}-results.csv`, createPollResultsCsv(current.standings))}><Download size={17} /> Download</button>}>
        {error && <p className="form-message">{error}</p>}
        {results.length ? <><label className="poll-category-select">Category<select value={selected} onChange={(event) => setSelected(event.target.value)}>{results.map((item) => <option value={item.definitionId} key={item.definitionId}>{item.category.label}</option>)}</select></label>{current && <PollResultsTable rows={current.standings} />}
            <section className="individual-ballots"><h2>Committee ballots</h2>{ballots.map((ballot) => <details key={ballot.ballotId}><summary>{ballot.voterName}</summary><ol>{ballot.rankings.map((ranking) => <li key={ranking.rank}>{ranking.teamName}</li>)}</ol></details>)}</section></> : !error && <div className="page-loading">Loading results</div>}
    </PollShell>;
}
