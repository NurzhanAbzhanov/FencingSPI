import { Lock, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import PollShell from '../../components/polls/PollShell';
import PollSpiReference from '../../components/polls/PollSpiReference';
import TeamSelectCombobox from '../../components/polls/TeamSelectCombobox';
import { validateBallotTeamIds } from '../../lib/pollDomain';
import { loadPollBallot, savePollBallot } from '../../lib/pollRepository';
import type { PollBallotView, PollCategorySlug } from '../../types/polls';
import type { PlatformUser } from '../../types/platform';
import './Polls.css';

export default function PollBallotPage({ slug, user }: { slug: PollCategorySlug; user: PlatformUser }) {
    const [view, setView] = useState<PollBallotView | null>(null);
    const [slots, setSlots] = useState<number[]>([]);
    const [reviewing, setReviewing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        loadPollBallot(slug, user.id).then((loaded) => {
            setView(loaded);
            const initial = Array.from({ length: loaded.category.rankLimit }, (_, index) => loaded.rankings[index] ?? loaded.lockedTeamIds[index] ?? 0);
            loaded.lockedTeamIds.forEach((teamId, index) => { initial[index] = teamId; });
            setSlots(initial);
        }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load ballot.'));
    }, [slug, user.id]);

    const lockedCount = view?.lockedTeamIds.length ?? 0;
    const candidatesById = useMemo(() => new Map(view?.candidates.map((candidate) => [candidate.teamId, candidate]) ?? []), [view]);
    if (error) return <PollShell title="Ballot unavailable" backHref="#/polls"><div className="empty-state"><p>{error}</p></div></PollShell>;
    if (!view) return <PollShell title="Coaches Poll" backHref="#/polls"><div className="page-loading">Loading ballot</div></PollShell>;
    if (view.prerequisite === 'overall-required') return <PollShell title={view.category.label} backHref="#/polls"><div className="prerequisite-state"><Lock size={26} /><h2>Complete overall ballot first</h2><p>The Division III ballot begins with the Division III schools from your submitted Team Overall ranking.</p><a className="button primary" href={`#/polls/vote/${view.category.gender === 'Men' ? 'men' : 'women'}_team_overall`}>Go to {view.category.gender === 'Men' ? "Men's" : "Women's"} Team Overall</a></div></PollShell>;

    const ballotView = view;

    function updateSlot(index: number, teamId: number) { setSlots((current) => current.map((value, currentIndex) => currentIndex === index ? teamId : value)); setMessage(''); }
    function quickRank(teamId: number) { setSlots((current) => { const next = [...current]; const empty = next.findIndex((value, index) => !value && index >= lockedCount); if (empty >= 0) next[empty] = teamId; return next; }); }
    function clearEditable() { setSlots((current) => current.map((value, index) => index < lockedCount ? value : 0)); }
    function review() { const problem = validateBallotTeamIds(slots, ballotView.category.rankLimit, new Set(ballotView.candidates.map((candidate) => candidate.teamId)), ballotView.lockedTeamIds); if (problem) setMessage(problem); else setReviewing(true); }
    async function submit() { setSaving(true); setMessage(''); try { await savePollBallot({ definitionId: ballotView.definitionId, teamIds: slots, submit: true }); setReviewing(false); setView({ ...ballotView, submitted: true, rankings: slots }); setMessage('Ballot submitted. You can continue editing until the poll closes.'); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not save ballot.'); } finally { setSaving(false); } }

    return <PollShell title={view.category.label} backHref="#/polls" actions={<span className={`poll-status ${view.period.status}`}>{view.period.status}</span>}>
        {view.submitted && <div className="editing-banner">This ballot is submitted. Changes remain available until the poll closes.</div>}
        <div className="ballot-layout">
            <section className="ballot-slots" aria-labelledby="ballot-rankings-title"><div className="poll-subheading"><h2 id="ballot-rankings-title">Your ranking</h2><button className="button subtle compact" type="button" onClick={clearEditable}><RotateCcw size={16} /> Clear editable</button></div>
                <ol>{slots.map((teamId, index) => <li key={index}><span className="rank-number">{index + 1}</span>{index < lockedCount ? <div className="locked-slot"><Lock size={16} /><span>{candidatesById.get(teamId)?.teamName}</span></div> : <TeamSelectCombobox rankNumber={index + 1} selectedTeamId={teamId} teams={view.candidates} selectedTeamIds={slots} onSelectTeam={(value) => updateSlot(index, value)} />}</li>)}</ol>
                {message && <p className="form-message" role="status">{message}</p>}
                <button className="button primary ballot-review-button" type="button" onClick={review} disabled={!view.period.effectivelyOpen}>Review ballot</button>
            </section>
            <PollSpiReference candidates={view.candidates} seasonSlug={view.period.seasonSlug} onRank={quickRank} rankedTeamIds={slots} />
        </div>
        {reviewing && <div className="modal-backdrop" role="presentation"><section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title"><h2 id="review-title">Review your ballot</h2><ol>{slots.map((teamId, index) => <li key={teamId}>{index + 1}. {candidatesById.get(teamId)?.teamName}</li>)}</ol><div className="dialog-actions"><button className="button secondary" type="button" onClick={() => setReviewing(false)}>Continue editing</button><button className="button primary" type="button" disabled={saving} onClick={submit}>{saving ? 'Submitting' : 'Confirm and submit'}</button></div></section></div>}
    </PollShell>;
}
