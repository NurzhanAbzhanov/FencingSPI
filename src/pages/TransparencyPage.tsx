import { ArrowLeft, LockOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getBallotDefinitions, getCommitteeBallots } from "../lib/ballotRepository";
import type { BallotDefinition, CommitteeBallot, PollScope, Program } from "../types/platform";
import type { Gender, Weapon } from "../types/types";

export default function TransparencyPage({ month, gender, weapon, programs }: { month: string; gender: Gender; weapon: Weapon; programs: Program[] }) {
    const [definitions, setDefinitions] = useState<BallotDefinition[]>([]);
    const [ballots, setBallots] = useState<CommitteeBallot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        getBallotDefinitions(programs).then(async (allDefinitions) => {
            const selected = allDefinitions.filter((definition) => definition.month === month && definition.gender === gender && definition.weapon === weapon);
            if (!active) return;
            setDefinitions(selected);
            const rows = await getCommitteeBallots(selected);
            if (active) setBallots(rows);
        }).catch((caught) => active && setError(caught instanceof Error ? caught.message : "Votes could not be loaded.")).finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [gender, month, programs, weapon]);
    const closed = definitions.length > 0 && definitions.every((definition) => ["Closed", "Published"].includes(definition.status));

    return <section className="page-section transparency-page"><a className="back-link" href="#/polls"><ArrowLeft size={16} /> Ballots</a><div className="page-title-row"><div><p className="eyebrow">Committee transparency</p><h1>{month} · {gender} · {weapon} votes</h1></div></div>
        {loading ? <div className="page-loading">Loading committee ballots</div> : error ? <div className="empty-state"><h2>Votes unavailable</h2><p>{error}</p></div> : !closed ? <div className="empty-state"><LockOpen size={24} /><h2>Votes become visible after close</h2><p>Individual coach ballots remain private while voting is open.</p></div> : <div className="transparency-scopes"><ScopeResults scope="Overall" definition={definitions.find((item) => item.scope === "Overall")} ballots={ballots.filter((item) => item.scope === "Overall")} programs={programs} /><ScopeResults scope="DIII" definition={definitions.find((item) => item.scope === "DIII")} ballots={ballots.filter((item) => item.scope === "DIII")} programs={programs} /></div>}
    </section>;
}

function ScopeResults({ scope, definition, ballots, programs }: { scope: PollScope; definition?: BallotDefinition; ballots: CommitteeBallot[]; programs: Program[] }) {
    const aggregate = useMemo(() => {
        if (!definition) return [];
        const points = new Map<number, number>();
        ballots.forEach((ballot) => ballot.rankings.forEach((ranking) => points.set(ranking.teamId, (points.get(ranking.teamId) ?? 0) + definition.rankLimit - ranking.rank + 1)));
        const sorted = [...points.entries()].sort((a, b) => b[1] - a[1] || (programs.find((item) => item.id === a[0])?.name ?? "").localeCompare(programs.find((item) => item.id === b[0])?.name ?? ""));
        let previousPoints: number | null = null; let rank = 0;
        return sorted.map(([teamId, total], index) => { if (total !== previousPoints) rank = index + 1; previousPoints = total; return { teamId, points: total, rank }; });
    }, [ballots, definition, programs]);
    return <section className="transparency-scope"><div className="ballot-column-heading"><div><h2>{scope === "DIII" ? "Division III" : scope}</h2><p>{ballots.length} submitted ballot{ballots.length === 1 ? "" : "s"}</p></div></div>
        {aggregate.length ? <div className="platform-table-wrap"><table className="platform-table transparency-table"><thead><tr><th>Rank</th><th>School</th><th>Points</th></tr></thead><tbody>{aggregate.map((row) => <tr key={row.teamId}><td>{row.rank}</td><td>{programs.find((program) => program.id === row.teamId)?.name ?? `School ${row.teamId}`}</td><td>{row.points}</td></tr>)}</tbody></table></div> : <p className="help-line transparency-empty">No submitted ballots were recorded.</p>}
        <div className="individual-ballots"><h3>Individual votes</h3>{ballots.map((ballot) => <details key={ballot.ballotId}><summary>{ballot.voterName}</summary><ol>{ballot.rankings.map((ranking) => <li key={ranking.teamId}>{programs.find((program) => program.id === ranking.teamId)?.name ?? `School ${ranking.teamId}`}</li>)}</ol></details>)}</div>
    </section>;
}
