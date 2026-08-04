import { CheckCircle2, Circle, ClipboardList, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { POLL_MONTHS, POLL_WEAPONS, createBallotDefinitions } from "../lib/platformData";
import { getBallotDefinitions, getBallotRankings } from "../lib/ballotRepository";
import type { PlatformUser, Program } from "../types/platform";
import type { Gender } from "../types/types";

export default function PollsPage({ programs, user }: { programs: Program[]; user: PlatformUser }) {
    const [month, setMonth] = useState<(typeof POLL_MONTHS)[number]>("October");
    const [definitions, setDefinitions] = useState(() => createBallotDefinitions(programs));
    const [counts, setCounts] = useState<Record<string, number>>({});
    useEffect(() => { getBallotDefinitions(programs).then(setDefinitions).catch(() => setDefinitions(createBallotDefinitions(programs))); }, [programs]);
    useEffect(() => { let active = true; Promise.all(definitions.map(async (definition) => [definition.id, (await getBallotRankings(definition.id, user.id)).length] as const)).then((entries) => active && setCounts(Object.fromEntries(entries))).catch(() => undefined); return () => { active = false; }; }, [definitions, user.id]);
    const rows = POLL_WEAPONS.flatMap((weapon) => (["Men", "Women"] as Gender[]).map((gender) => {
        const overall = definitions.find((item) => item.month === month && item.weapon === weapon && item.gender === gender && item.scope === "Overall")!;
        const d3 = definitions.find((item) => item.month === month && item.weapon === weapon && item.gender === gender && item.scope === "DIII")!;
        const overallCount = counts[overall.id] ?? 0; const d3Count = counts[d3.id] ?? 0;
        return { weapon, gender, overall, d3, overallCount, d3Count };
    }));

    return <section className="page-section polls-page">
        <div className="page-title-row"><div><p className="eyebrow">Coaches poll</p><h1>Ballots</h1></div><div className="session-user">Signed in as <strong>{user.name}</strong></div></div>
        <div className="month-tabs" role="tablist" aria-label="Poll month">{POLL_MONTHS.map((item) => <button role="tab" aria-selected={month === item} className={month === item ? "active" : ""} onClick={() => setMonth(item)} key={item}>{item}{item === "October" && <span>Preseason</span>}</button>)}</div>
        <div className="platform-table-wrap"><table className="platform-table ballot-list"><thead><tr><th>Ballot</th><th>Gender</th><th>Status</th><th>Overall</th><th>DIII</th><th>Action</th></tr></thead><tbody>{rows.map((row) => {
            const complete = row.overallCount === row.overall.rankLimit && row.d3Count === row.d3.rankLimit;
            return <tr key={`${row.weapon}-${row.gender}`}><td className="school-cell"><strong>{row.weapon}</strong></td><td>{row.gender}</td><td><span className={`status-badge ${row.overall.status.toLowerCase()}`}>{row.overall.status}</span></td>
                <td>{progress(row.overallCount, row.overall.rankLimit)}</td><td>{progress(row.d3Count, row.d3.rankLimit)}</td>
                <td><a className="icon-text-link" href={`#/polls/vote/${month}/${row.gender}/${row.weapon}`}><ClipboardList size={16} /> {complete ? "Review" : "Rank"}</a>{row.overall.status === "Closed" && <a className="icon-text-link" href={`#/polls/transparency/${month}/${row.gender}/${row.weapon}`}><Eye size={16} /> Votes</a>}</td></tr>;
        })}</tbody></table></div>
        <p className="help-line">Each coach submits Team, Epee, Foil and Sabre ballots for both genders. Overall and DIII rankings are edited together.</p>
    </section>;
}

function progress(current: number, total: number) {
    const Icon = current === total ? CheckCircle2 : Circle;
    return <span className={current === total ? "progress complete" : "progress"}><Icon size={16} /> {current} of {total}</span>;
}
