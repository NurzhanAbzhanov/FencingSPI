import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    AlertTriangle,
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Check,
    Eye,
    GripVertical,
    Info,
    Plus,
    Redo2,
    Save,
    Search,
    Undo2,
    X,
} from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import SchoolLogo from "../components/SchoolLogo";
import { getBallotDefinitions, getBallotState, saveBallotDraft, submitBallots } from "../lib/ballotRepository";
import { createBallotDefinitions } from "../lib/platformData";
import { formatDivision } from "../lib/standingsPresentation";
import type {
    BallotDefinition,
    BallotRanking,
    BallotStatus,
    PlatformUser,
    PollResult,
    Program,
    SeasonMatch,
    Standing,
} from "../types/platform";
import type { Gender, Weapon } from "../types/types";

type Candidate = { program: Program; spi: number };
type BallotValues = { overall: number[]; d3: number[] };
type HistoryState = { present: BallotValues; past: BallotValues[]; future: BallotValues[] };
type HistoryAction =
    | { type: "hydrate"; value: BallotValues }
    | { type: "change"; scope: keyof BallotValues; value: number[] }
    | { type: "undo" }
    | { type: "redo" };

type BallotPageProps = {
    month: string;
    gender: Gender;
    weapon: Weapon;
    programs: Program[];
    standings: Standing[];
    matches: SeasonMatch[];
    pollResults: PollResult[];
    user: PlatformUser;
};

export default function BallotPage({ month, gender, weapon, programs, standings, matches, pollResults, user }: BallotPageProps) {
    const [allDefinitions, setAllDefinitions] = useState(() => createBallotDefinitions(programs));
    const [definitionsLoaded, setDefinitionsLoaded] = useState(false);
    const definitions = useMemo(() => allDefinitions.filter((item) => item.month === month && item.gender === gender && item.weapon === weapon), [allDefinitions, gender, month, weapon]);
    const overallDefinition = definitions.find((item) => item.scope === "Overall")!;
    const d3Definition = definitions.find((item) => item.scope === "DIII")!;
    const candidates = useMemo(() => programs
        .filter((program) => program.gender === gender)
        .map((program) => ({ program, spi: standings.find((item) => item.teamId === program.id && item.weapon === weapon)?.spi ?? 0 })), [gender, programs, standings, weapon]);
    const [history, dispatch] = useReducer(historyReducer, {
        present: { overall: Array(overallDefinition.rankLimit).fill(0), d3: Array(d3Definition.rankLimit).fill(0) },
        past: [],
        future: [],
    });
    const [statuses, setStatuses] = useState<{ overall: BallotStatus; d3: BallotStatus }>({ overall: "draft", d3: "draft" });
    const [hydrated, setHydrated] = useState(false);
    const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
    const [search, setSearch] = useState("");
    const [conference, setConference] = useState("All");
    const [region, setRegion] = useState("All");
    const [showSpi, setShowSpi] = useState(false);
    const [unrankedOnly, setUnrankedOnly] = useState(false);
    const [researchCandidate, setResearchCandidate] = useState<Candidate | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => { getBallotDefinitions(programs).then((loaded) => { setAllDefinitions(loaded); setDefinitionsLoaded(true); }).catch(() => setDefinitionsLoaded(true)); }, [programs]);
    useEffect(() => {
        if (!definitionsLoaded) return;
        let active = true;
        Promise.all([getBallotState(overallDefinition.id, user.id), getBallotState(d3Definition.id, user.id)])
            .then(([overallState, d3State]) => {
                if (!active) return;
                dispatch({ type: "hydrate", value: {
                    overall: rankingsToIds(overallState.rankings, overallDefinition.rankLimit),
                    d3: rankingsToIds(d3State.rankings, d3Definition.rankLimit),
                } });
                setStatuses({ overall: overallState.status, d3: d3State.status });
                setHydrated(true);
            })
            .catch((caught) => { if (active) { setError(caught instanceof Error ? caught.message : "Could not load ballot."); setHydrated(true); } });
        return () => { active = false; };
    }, [d3Definition.id, d3Definition.rankLimit, definitionsLoaded, overallDefinition.id, overallDefinition.rankLimit, user.id]);

    const locked = statuses.overall === "submitted" || statuses.d3 === "submitted";
    useEffect(() => {
        if (!hydrated || locked) return;
        const timeout = window.setTimeout(() => {
            setSaveState("saving");
            Promise.all([
                saveBallotDraft(overallDefinition.id, user.id, idsToRankings(history.present.overall)),
                saveBallotDraft(d3Definition.id, user.id, idsToRankings(history.present.d3)),
            ]).then(() => setSaveState("saved")).catch((caught) => {
                setSaveState("error");
                setError(caught instanceof Error ? caught.message : "Draft could not be saved.");
            });
        }, 700);
        return () => window.clearTimeout(timeout);
    }, [d3Definition.id, history.present, hydrated, locked, overallDefinition.id, user.id]);

    const d3OrderInOverall = history.present.overall.filter((teamId) => candidates.find((candidate) => candidate.program.id === teamId)?.program.division === "3");
    const warningCount = history.present.d3.filter((teamId, index) => teamId && d3OrderInOverall.includes(teamId) && d3OrderInOverall.indexOf(teamId) !== index).length;
    const complete = isComplete(history.present.overall) && isComplete(history.present.d3);
    const conferences = uniqueValues(candidates.map((candidate) => candidate.program.conference));
    const regions = uniqueValues(candidates.map((candidate) => candidate.program.region));
    const visibleCandidates = (items: Candidate[], ranked: number[]) => items.filter(({ program }) => {
        const matchesSearch = program.name.toLowerCase().includes(search.trim().toLowerCase());
        return matchesSearch && (conference === "All" || program.conference === conference) && (region === "All" || program.region === region) && (!unrankedOnly || !ranked.includes(program.id));
    });

    async function submit() {
        if (!complete || locked) return;
        setError("");
        try {
            await Promise.all([
                saveBallotDraft(overallDefinition.id, user.id, idsToRankings(history.present.overall)),
                saveBallotDraft(d3Definition.id, user.id, idsToRankings(history.present.d3)),
            ]);
            await submitBallots([overallDefinition.id, d3Definition.id], user.id);
            setStatuses({ overall: "submitted", d3: "submitted" });
            setReviewOpen(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Ballots could not be submitted.");
        }
    }

    function change(scope: keyof BallotValues, value: number[]) {
        if (!locked) dispatch({ type: "change", scope, value });
    }

    return <section className="page-section ballot-page">
        <a className="back-link" href="#/polls"><ArrowLeft size={16} /> Ballots</a>
        <div className="page-title-row">
            <div><p className="eyebrow">{month} · {gender}</p><h1>{weapon} coaches poll</h1></div>
            <div className={`autosave ${saveState === "error" ? "error" : ""}`}><Save size={15} /> {locked ? "Submitted and locked" : saveState === "saving" ? "Saving draft" : saveState === "error" ? "Save failed" : "Draft saved"}</div>
        </div>
        {locked && <div className="locked-banner"><Check size={18} /><span>Both ballots are submitted. An administrator must reopen them before you can make changes.</span></div>}
        {warningCount > 0 && !locked && <div className="warning-banner"><AlertTriangle size={18} /><span>{warningCount} DIII placement{warningCount === 1 ? "" : "s"} differ between the Overall and DIII ballots. Differences are allowed, but should be reviewed for consistency.</span></div>}
        {error && <p className="form-message error">{error}</p>}

        <div className="ballot-tools" aria-label="Ballot tools">
            <label className="ballot-search"><span>Find school</span><div><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" /></div></label>
            <label><span>Conference</span><select value={conference} onChange={(event) => setConference(event.target.value)}><option>All</option>{conferences.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Region</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>All</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="check-control"><input type="checkbox" checked={unrankedOnly} onChange={(event) => setUnrankedOnly(event.target.checked)} /> Unranked only</label>
            <label className="check-control"><input type="checkbox" checked={showSpi} onChange={(event) => setShowSpi(event.target.checked)} /> Show SPI</label>
            <div className="history-controls">
                <button className="icon-button" aria-label="Undo last ranking change" title="Undo" disabled={!history.past.length || locked} onClick={() => dispatch({ type: "undo" })}><Undo2 size={18} /></button>
                <button className="icon-button" aria-label="Redo ranking change" title="Redo" disabled={!history.future.length || locked} onClick={() => dispatch({ type: "redo" })}><Redo2 size={18} /></button>
            </div>
        </div>

        <div className="paired-ballots">
            <BallotWorkspace title="Overall" definition={overallDefinition} values={history.present.overall} onChange={(value) => change("overall", value)} allCandidates={candidates} candidates={visibleCandidates(stableCandidateOrder(candidates, `${user.id}:${overallDefinition.id}`), history.present.overall)} showSpi={showSpi} locked={locked} onResearch={setResearchCandidate} />
            <BallotWorkspace title="Division III" definition={d3Definition} values={history.present.d3} onChange={(value) => change("d3", value)} allCandidates={candidates.filter((candidate) => candidate.program.division === "3")} candidates={visibleCandidates(stableCandidateOrder(candidates.filter((candidate) => candidate.program.division === "3"), `${user.id}:${d3Definition.id}`), history.present.d3)} showSpi={showSpi} locked={locked} onResearch={setResearchCandidate} />
        </div>

        <div className="ballot-submit-bar"><div><strong>{locked ? "Ballots submitted" : complete ? "Ready to review" : "Ballot incomplete"}</strong><span>{locked ? "Your rankings are final unless an administrator reopens them." : complete ? "Confirm both lists before submission." : "Every rank must contain a different school."}</span></div><button className="button primary" disabled={!complete || locked} onClick={() => setReviewOpen(true)}><Eye size={17} /> Review and submit</button></div>

        {researchCandidate && <ResearchDialog candidate={researchCandidate} gender={gender} weapon={weapon} matches={matches} pollResults={pollResults} onClose={() => setResearchCandidate(null)} />}
        {reviewOpen && <ReviewDialog overall={history.present.overall} d3={history.present.d3} candidates={candidates} onClose={() => setReviewOpen(false)} onSubmit={submit} />}
    </section>;
}

function BallotWorkspace({ title, definition, values, onChange, candidates, allCandidates, showSpi, locked, onResearch }: { title: string; definition: BallotDefinition; values: number[]; onChange: (value: number[]) => void; candidates: Candidate[]; allCandidates: Candidate[]; showSpi: boolean; locked: boolean; onResearch: (candidate: Candidate) => void }) {
    const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
    function addCandidate(teamId: number) {
        if (values.includes(teamId)) return;
        const nextOpen = values.indexOf(0);
        if (nextOpen < 0) return;
        onChange(values.map((value, index) => index === nextOpen ? teamId : value));
    }
    function move(index: number, offset: number) {
        const target = index + offset;
        if (target < 0 || target >= values.length) return;
        const next = [...values];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    }
    function handleDragStart(event: DragStartEvent) {
        const teamId = Number(event.active.data.current?.teamId);
        setActiveCandidate(allCandidates.find((candidate) => candidate.program.id === teamId) ?? null);
    }
    function handleDragEnd(event: DragEndEvent) {
        setActiveCandidate(null);
        if (!event.over || locked) return;
        const sourceType = event.active.data.current?.type;
        const sourceIndex = Number(event.active.data.current?.index);
        const teamId = Number(event.active.data.current?.teamId);
        if (event.over.data.current?.type === "pool" && sourceType === "rank") {
            onChange(values.map((value, index) => index === sourceIndex ? 0 : value));
            return;
        }
        if (event.over.data.current?.type !== "slot") return;
        const targetIndex = Number(event.over.data.current.index);
        const next = [...values];
        if (sourceType === "rank") [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
        else {
            const existingIndex = next.indexOf(teamId);
            if (existingIndex >= 0) next[existingIndex] = next[targetIndex];
            next[targetIndex] = teamId;
        }
        onChange(next);
    }

    return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragCancel={() => setActiveCandidate(null)} onDragEnd={handleDragEnd} accessibility={{ screenReaderInstructions: { draggable: "Press space or enter to pick up a school. Use arrow keys to move it to a rank, then press space or enter to drop." } }}>
        <section className="ballot-column">
            <div className="ballot-column-heading"><div><h2>{title}</h2><p>{values.filter(Boolean).length} of {definition.rankLimit} ranked</p></div><span className={`status-badge ${definition.status.toLowerCase()}`}>{definition.status}</span></div>
            <div className="rank-list">{values.map((teamId, index) => <RankSlot key={index} title={title} index={index} teamId={teamId} candidate={allCandidates.find((item) => item.program.id === teamId)} showSpi={showSpi} locked={locked} onMove={move} onRemove={() => onChange(values.map((value, itemIndex) => itemIndex === index ? 0 : value))} onResearch={onResearch} total={values.length} />)}</div>
            <CandidatePool candidates={candidates} ranked={values} showSpi={showSpi} locked={locked} onAdd={addCandidate} onResearch={onResearch} title={title} />
        </section>
        <DragOverlay>{activeCandidate ? <CandidateTile candidate={activeCandidate} showSpi={showSpi} overlay /> : null}</DragOverlay>
    </DndContext>;
}

function RankSlot({ title, index, teamId, candidate, showSpi, locked, onMove, onRemove, onResearch, total }: { title: string; index: number; teamId: number; candidate?: Candidate; showSpi: boolean; locked: boolean; onMove: (index: number, offset: number) => void; onRemove: () => void; onResearch: (candidate: Candidate) => void; total: number }) {
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `${title}-slot-${index}`, data: { type: "slot", index }, disabled: locked });
    const { setNodeRef: setDragRef, listeners, attributes, transform, isDragging } = useDraggable({ id: `${title}-rank-${index}`, data: { type: "rank", index, teamId }, disabled: locked || !candidate });
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
    return <div ref={setDropRef} className={`rank-slot ${isOver ? "over" : ""} ${candidate ? "filled" : ""}`}>
        <span className="rank-number">{index + 1}</span>
        {candidate ? <div ref={setDragRef} style={style} className={`ranked-team ${isDragging ? "dragging" : ""}`}>
            <button className="drag-handle" aria-label={`Move ${candidate.program.name}, currently rank ${index + 1}`} {...listeners} {...attributes}><GripVertical size={17} /></button>
            <SchoolLogo program={candidate.program} size="small" />
            <div className="ranked-team-name"><strong>{candidate.program.name}</strong><span>{candidate.program.conference} · Region {candidate.program.region}{showSpi ? ` · SPI ${candidate.spi.toFixed(2)}` : ""}</span></div>
            <div className="rank-actions">
                <button aria-label={`Research ${candidate.program.name}`} title="Research" onClick={() => onResearch(candidate)}><Info size={15} /></button>
                <button aria-label={`Move ${candidate.program.name} up`} title="Move up" disabled={locked || index === 0} onClick={() => onMove(index, -1)}><ArrowUp size={15} /></button>
                <button aria-label={`Move ${candidate.program.name} down`} title="Move down" disabled={locked || index === total - 1} onClick={() => onMove(index, 1)}><ArrowDown size={15} /></button>
                <button aria-label={`Remove ${candidate.program.name}`} title="Remove" disabled={locked} onClick={onRemove}><X size={15} /></button>
            </div>
        </div> : <span className="empty-rank">Drop a school here</span>}
    </div>;
}

function CandidatePool({ candidates, ranked, showSpi, locked, onAdd, onResearch, title }: { candidates: Candidate[]; ranked: number[]; showSpi: boolean; locked: boolean; onAdd: (teamId: number) => void; onResearch: (candidate: Candidate) => void; title: string }) {
    const { setNodeRef, isOver } = useDroppable({ id: `${title}-pool`, data: { type: "pool" }, disabled: locked });
    return <div ref={setNodeRef} className={`candidate-pool ${isOver ? "over" : ""}`}><div className="candidate-pool-heading"><div><h3>School pool</h3><span>Order is randomized for this ballot</span></div><span>{candidates.length} shown</span></div>
        <div className="candidate-grid">{candidates.map((candidate) => <DraggableCandidate key={candidate.program.id} candidate={candidate} ranked={ranked.includes(candidate.program.id)} showSpi={showSpi} locked={locked} onAdd={() => onAdd(candidate.program.id)} onResearch={() => onResearch(candidate)} scope={title} />)}</div>
        {candidates.length === 0 && <p className="candidate-empty">No schools match these filters.</p>}
    </div>;
}

function DraggableCandidate({ candidate, ranked, showSpi, locked, onAdd, onResearch, scope }: { candidate: Candidate; ranked: boolean; showSpi: boolean; locked: boolean; onAdd: () => void; onResearch: () => void; scope: string }) {
    const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({ id: `${scope}-candidate-${candidate.program.id}`, data: { type: "candidate", teamId: candidate.program.id }, disabled: locked || ranked });
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
    return <article ref={setNodeRef} style={style} className={`candidate-tile ${ranked ? "ranked" : ""} ${isDragging ? "dragging" : ""}`}>
        <button className="candidate-drag" disabled={locked || ranked} aria-label={`${ranked ? "Ranked" : "Drag"} ${candidate.program.name}`} {...listeners} {...attributes}><GripVertical size={17} /></button>
        <SchoolLogo program={candidate.program} size="small" />
        <div className="candidate-name"><strong>{candidate.program.name}</strong><span>Division {formatDivision(candidate.program.division)} · {candidate.program.conference} · {candidate.program.region}</span>{showSpi && <span>SPI {candidate.spi.toFixed(2)}</span>}</div>
        <button className="tile-action" aria-label={`Research ${candidate.program.name}`} title="Research" onClick={onResearch}><Info size={16} /></button>
        <button className="tile-action" disabled={locked || ranked} aria-label={`Add ${candidate.program.name} to next open rank`} title={ranked ? "Already ranked" : "Add to next open rank"} onClick={onAdd}>{ranked ? <Check size={16} /> : <Plus size={16} />}</button>
    </article>;
}

function CandidateTile({ candidate, showSpi, overlay = false }: { candidate: Candidate; showSpi: boolean; overlay?: boolean }) {
    return <div className={`candidate-tile overlay ${overlay ? "active" : ""}`}><GripVertical size={17} /><SchoolLogo program={candidate.program} size="small" /><div className="candidate-name"><strong>{candidate.program.name}</strong><span>Division {formatDivision(candidate.program.division)} · {candidate.program.conference}</span>{showSpi && <span>SPI {candidate.spi.toFixed(2)}</span>}</div></div>;
}

function ResearchDialog({ candidate, gender, weapon, matches, pollResults, onClose }: { candidate: Candidate; gender: Gender; weapon: Weapon; matches: SeasonMatch[]; pollResults: PollResult[]; onClose: () => void }) {
    const teamMatches = matches.filter((match) => match.gender === gender && (match.leftTeamId === candidate.program.id || match.rightTeamId === candidate.program.id));
    const wins = teamMatches.filter((match) => scoreFor(match, candidate.program.id, weapon) > scoreAgainst(match, candidate.program.id, weapon)).length;
    const previousPolls = pollResults.filter((result) => result.teamId === candidate.program.id && result.gender === gender && result.weapon === weapon).sort((a, b) => monthIndex(b.month) - monthIndex(a.month));
    return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog-panel research-dialog" role="dialog" aria-modal="true" aria-labelledby="research-title"><div className="dialog-heading"><div className="school-inline"><SchoolLogo program={candidate.program} /><div><p className="eyebrow">School research</p><h2 id="research-title">{candidate.program.name}</h2></div></div><button className="icon-button" aria-label="Close research" onClick={onClose}><X size={19} /></button></div>
        <dl className="research-summary"><div><dt>SPI</dt><dd>{candidate.spi.toFixed(2)}</dd></div><div><dt>Record</dt><dd>{wins}-{teamMatches.length - wins}</dd></div><div><dt>Division</dt><dd>{formatDivision(candidate.program.division)}</dd></div><div><dt>Conference</dt><dd>{candidate.program.conference}</dd></div><div><dt>Region</dt><dd>{candidate.program.region}</dd></div></dl>
        <h3>Published poll history</h3>{previousPolls.length ? <div className="research-polls">{previousPolls.map((poll) => <span key={`${poll.definitionId}-${poll.scope}`}>{poll.month} {poll.scope}: <strong>#{poll.rank}</strong></span>)}</div> : <p className="help-line">No published poll results for this ballot yet.</p>}
        <div className="dialog-actions"><a className="button secondary" href={`#/schools/${candidate.program.id}/results?season=2025-26`}>View match results</a><button className="button primary" onClick={onClose}>Done</button></div>
    </section></div>;
}

function ReviewDialog({ overall, d3, candidates, onClose, onSubmit }: { overall: number[]; d3: number[]; candidates: Candidate[]; onClose: () => void; onSubmit: () => void }) {
    const list = (values: number[]) => <ol className="review-ranking">{values.map((teamId) => <li key={teamId}>{candidates.find((candidate) => candidate.program.id === teamId)?.program.name}</li>)}</ol>;
    return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog-panel review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title"><div className="dialog-heading"><div><p className="eyebrow">Final review</p><h2 id="review-title">Submit both ballots?</h2></div><button className="icon-button" aria-label="Close review" onClick={onClose}><X size={19} /></button></div><p>Submission locks both rankings. An administrator can reopen them while the poll is open.</p><div className="review-columns"><div><h3>Overall</h3>{list(overall)}</div><div><h3>Division III</h3>{list(d3)}</div></div><div className="dialog-actions"><button className="button secondary" onClick={onClose}>Continue editing</button><button className="button primary" onClick={onSubmit}><Check size={17} /> Submit both ballots</button></div></section></div>;
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
    if (action.type === "hydrate") return { present: action.value, past: [], future: [] };
    if (action.type === "undo" && state.past.length) return { present: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.present, ...state.future] };
    if (action.type === "redo" && state.future.length) return { present: state.future[0], past: [...state.past, state.present], future: state.future.slice(1) };
    if (action.type === "change" && action.value.some((value, index) => value !== state.present[action.scope][index])) return { present: { ...state.present, [action.scope]: action.value }, past: [...state.past, state.present], future: [] };
    return state;
}

function stableCandidateOrder(candidates: Candidate[], seed: string) {
    return [...candidates].sort((a, b) => stableHash(`${seed}:${a.program.id}`) - stableHash(`${seed}:${b.program.id}`));
}
function stableHash(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function uniqueValues(values: string[]) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function isComplete(values: number[]) { return values.every(Boolean) && new Set(values).size === values.length; }
function rankingsToIds(rankings: BallotRanking[], limit: number) { const values = Array<number>(limit).fill(0); rankings.forEach((item) => { if (item.rank <= limit) values[item.rank - 1] = item.teamId; }); return values; }
function idsToRankings(values: number[]): BallotRanking[] { return values.map((teamId, index) => ({ teamId, rank: index + 1 })).filter((item) => item.teamId > 0); }
function monthIndex(month: string) { return ["October", "November", "December", "January"].indexOf(month); }
function scoreFor(match: SeasonMatch, teamId: number, weapon: Weapon) { const left = match.leftTeamId === teamId; if (weapon === "Team") return left ? match.leftSabre + match.leftFoil + match.leftEpee : match.rightSabre + match.rightFoil + match.rightEpee; const key = weapon === "Sabre" ? "Sabre" : weapon; return match[`${left ? "left" : "right"}${key}` as keyof SeasonMatch] as number; }
function scoreAgainst(match: SeasonMatch, teamId: number, weapon: Weapon) { const opponentId = match.leftTeamId === teamId ? match.rightTeamId : match.leftTeamId; return scoreFor(match, opponentId, weapon); }
