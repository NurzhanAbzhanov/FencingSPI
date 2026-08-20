import { ArrowLeft, Download } from "lucide-react";
import { useMemo } from "react";
import SchoolLogo from "../components/SchoolLogo";
import { formatDivision } from "../lib/standingsPresentation";
import type { Program, SeasonMatch } from "../types/platform";

export default function SchoolResultsPage({ teamId, season, programs, matches }: { teamId: number; season: string; programs: Program[]; matches: SeasonMatch[] }) {
    const program = programs.find((item) => item.id === teamId);
    const rows = useMemo(() => matches
        .filter((match) => match.leftTeamId === teamId || match.rightTeamId === teamId)
        .map((match) => orientMatch(match, teamId, programs))
        .sort((a, b) => b.date.localeCompare(a.date)), [matches, programs, teamId]);

    if (!program) return <section className="page-section"><h1>Program not found</h1><a href="#/spi">Return to standings</a></section>;
    const currentProgram = program;

    function download() {
        const lines = [["Date", "Opponent", "Result", "Total", "Epee", "Foil", "Sabre", "Host"], ...rows.map((row) => [
            row.date, row.opponent, row.outcome, `${row.totalFor}-${row.totalAgainst}`, `${row.epeeFor}-${row.epeeAgainst}`,
            `${row.foilFor}-${row.foilAgainst}`, `${row.sabreFor}-${row.sabreAgainst}`, row.host,
        ])];
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([lines.map((line) => line.join(",")).join("\n")], { type: "text/csv" }));
        link.download = `${season}-${currentProgram.name}-matches.csv`.replaceAll(" ", "-").toLowerCase();
        link.click();
        URL.revokeObjectURL(link.href);
    }

    return <section className="page-section results-detail-page">
        <a className="back-link" href="#/spi"><ArrowLeft size={16} /> SPI standings</a>
        <div className="school-heading">
            <SchoolLogo program={currentProgram} />
            <div><p className="eyebrow">{season} match results</p><h1>{currentProgram.name}</h1><p>{currentProgram.gender} · {formatDivision(currentProgram.division)} · {currentProgram.region} · {currentProgram.conferences.join(", ")}</p></div>
            <button className="button secondary" onClick={download} disabled={!rows.length}><Download size={17} /> Download matches</button>
        </div>
        <div className="platform-table-wrap"><table className="platform-table matches-table"><thead><tr>
            <th>Date</th><th>Opponent</th><th>Result</th><th>Total</th><th>Epee</th><th>Foil</th><th>Sabre</th><th>Host</th>
        </tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}>
            <td>{formatDate(row.date)}</td><td className="school-cell">{row.opponent}</td><td><span className={`outcome ${row.outcome === "W" ? "win" : "loss"}`}>{row.outcome}</span></td>
            <td className="numeric score-cell">{row.totalFor}–{row.totalAgainst}</td><td className="numeric">{row.epeeFor}–{row.epeeAgainst}</td>
            <td className="numeric">{row.foilFor}–{row.foilAgainst}</td><td className="numeric">{row.sabreFor}–{row.sabreAgainst}</td><td>{row.host}</td>
        </tr>) : <tr><td className="empty-table" colSpan={8}>No matches are loaded for this program and season.</td></tr>}</tbody></table></div>
    </section>;
}

function orientMatch(match: SeasonMatch, teamId: number, programs: Program[]) {
    const isLeft = match.leftTeamId === teamId;
    const opponentId = isLeft ? match.rightTeamId : match.leftTeamId;
    const sabreFor = isLeft ? match.leftSabre : match.rightSabre;
    const foilFor = isLeft ? match.leftFoil : match.rightFoil;
    const epeeFor = isLeft ? match.leftEpee : match.rightEpee;
    const sabreAgainst = isLeft ? match.rightSabre : match.leftSabre;
    const foilAgainst = isLeft ? match.rightFoil : match.leftFoil;
    const epeeAgainst = isLeft ? match.rightEpee : match.leftEpee;
    const totalFor = sabreFor + foilFor + epeeFor;
    const totalAgainst = sabreAgainst + foilAgainst + epeeAgainst;
    return { id: match.id, date: match.date, host: match.host, opponent: programs.find((program) => program.id === opponentId)?.name ?? `Team ${opponentId}`, sabreFor, foilFor, epeeFor, sabreAgainst, foilAgainst, epeeAgainst, totalFor, totalAgainst, outcome: totalFor > totalAgainst ? "W" : "L" };
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
