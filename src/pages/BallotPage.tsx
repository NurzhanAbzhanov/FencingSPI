import { AlertTriangle, ArrowLeft, Check, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createBallotDefinitions } from "../lib/platformData";
import { getBallotDefinitions, getBallotRankings, saveBallotDraft, submitBallots } from "../lib/ballotRepository";
import type { BallotDefinition, BallotRanking, PlatformUser, Program, Standing } from "../types/platform";
import type { Gender, Weapon } from "../types/types";

export default function BallotPage({ month, gender, weapon, programs, standings, user }: { month: string; gender: Gender; weapon: Weapon; programs: Program[]; standings: Standing[]; user: PlatformUser }) {
    const [allDefinitions, setAllDefinitions] = useState(() => createBallotDefinitions(programs));
    const definitions = useMemo(() => allDefinitions.filter((item) => item.month === month && item.gender === gender && item.weapon === weapon), [allDefinitions, gender, month, weapon]);
    const overallDefinition = definitions.find((item) => item.scope === "Overall")!; const d3Definition = definitions.find((item) => item.scope === "DIII")!;
    const candidates = useMemo(() => programs.filter((program) => program.gender === gender).map((program) => ({ program, spi: standings.find((item) => item.teamId === program.id && item.weapon === weapon)?.spi ?? 0 })).sort((a, b) => b.spi - a.spi), [gender, programs, standings, weapon]);
    const [overall, setOverall] = useState(() => Array<number>(overallDefinition.rankLimit).fill(0));
    const [d3, setD3] = useState(() => Array<number>(d3Definition.rankLimit).fill(0));
    const [hydrated, setHydrated] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => { getBallotDefinitions(programs).then(setAllDefinitions).catch(() => undefined); }, [programs]);
    useEffect(() => { let active = true; Promise.all([getBallotRankings(overallDefinition.id, user.id), getBallotRankings(d3Definition.id, user.id)]).then(([overallRows, d3Rows]) => { if (!active) return; setOverall(rankingsToIds(overallRows, overallDefinition.rankLimit)); setD3(rankingsToIds(d3Rows, d3Definition.rankLimit)); setHydrated(true); }).catch(() => setHydrated(true)); return () => { active = false; }; }, [d3Definition.id, d3Definition.rankLimit, overallDefinition.id, overallDefinition.rankLimit, user.id]);
    useEffect(() => { if (!hydrated) return; const timeout = window.setTimeout(() => { saveBallotDraft(overallDefinition.id, user.id, idsToRankings(overall)).catch(() => undefined); }, 500); return () => window.clearTimeout(timeout); }, [hydrated, overall, overallDefinition.id, user.id]);
    useEffect(() => { if (!hydrated) return; const timeout = window.setTimeout(() => { saveBallotDraft(d3Definition.id, user.id, idsToRankings(d3)).catch(() => undefined); }, 500); return () => window.clearTimeout(timeout); }, [d3, d3Definition.id, hydrated, user.id]);
    const warningCount = d3.filter((teamId, index) => teamId && overall.includes(teamId) && overall.filter((id) => candidates.find((candidate) => candidate.program.id === id)?.program.division === "3").indexOf(teamId) !== index).length;
    const complete = overall.every(Boolean) && d3.every(Boolean) && new Set(overall).size === overall.length && new Set(d3).size === d3.length;

    async function submit() { if (!complete) return; await Promise.all([saveBallotDraft(overallDefinition.id, user.id, idsToRankings(overall)), saveBallotDraft(d3Definition.id, user.id, idsToRankings(d3))]); await submitBallots([overallDefinition.id, d3Definition.id], user.id); setSubmitted(true); }
    return <section className="page-section ballot-page"><a className="back-link" href="#/polls"><ArrowLeft size={16} /> Ballots</a>
        <div className="page-title-row"><div><p className="eyebrow">{month} · {gender}</p><h1>{weapon} coaches poll</h1></div><span className="autosave"><Save size={15} /> Draft saved automatically</span></div>
        {warningCount > 0 && <div className="warning-banner"><AlertTriangle size={18} /><span>{warningCount} DIII placement{warningCount === 1 ? "" : "s"} differ between the Overall and DIII ballots. Differences are allowed, but should be reviewed for consistency.</span></div>}
        <div className="paired-ballots">
            <BallotColumn title="Overall" definition={overallDefinition} values={overall} setValues={setOverall} candidates={candidates} />
            <BallotColumn title="Division III" definition={d3Definition} values={d3} setValues={setD3} candidates={candidates.filter((candidate) => candidate.program.division === "3")} />
        </div>
        <div className="ballot-submit-bar"><div><strong>{complete ? "Ready to submit" : "Ballot incomplete"}</strong><span>{complete ? "Review both columns, then submit." : "Every rank must contain a different school."}</span></div><button className="button primary" disabled={!complete || submitted} onClick={submit}><Check size={17} /> {submitted ? "Submitted" : "Submit both ballots"}</button></div>
    </section>;
}

type Candidate = { program: Program; spi: number };
function BallotColumn({ title, definition, values, setValues, candidates }: { title: string; definition: BallotDefinition; values: number[]; setValues: React.Dispatch<React.SetStateAction<number[]>>; candidates: Candidate[] }) {
    return <section className="ballot-column"><div className="ballot-column-heading"><div><h2>{title}</h2><p>Rank {definition.rankLimit} {title === "Overall" ? "schools" : "DIII programs"}</p></div><span className={`status-badge ${definition.status.toLowerCase()}`}>{definition.status}</span></div>
        <div className="rank-list">{values.map((teamId, index) => { const selected = candidates.find((candidate) => candidate.program.id === teamId); return <div className="rank-row" key={index}><span className="rank-number">{index + 1}</span><select aria-label={`${title} rank ${index + 1}`} value={teamId || ""} onChange={(event) => setValues((current) => current.map((value, itemIndex) => itemIndex === index ? Number(event.target.value) : value))}><option value="">Select school</option>{candidates.map(({ program }) => <option key={program.id} value={program.id} disabled={values.includes(program.id) && program.id !== teamId}>{program.name}</option>)}</select><span className="ballot-spi">{selected ? `SPI ${selected.spi.toFixed(2)}` : ""}</span>{selected && <a href={`#/schools/${selected.program.id}/results?season=2025-26`}>Results</a>}</div>; })}</div>
    </section>;
}

function rankingsToIds(rankings: BallotRanking[], limit: number) { const values = Array<number>(limit).fill(0); rankings.forEach((item) => { if (item.rank <= limit) values[item.rank - 1] = item.teamId; }); return values; }
function idsToRankings(values: number[]): BallotRanking[] { return values.map((teamId, index) => ({ teamId, rank: index + 1 })).filter((item) => item.teamId > 0); }
