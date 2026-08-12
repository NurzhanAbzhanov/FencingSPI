import { Download, List } from "lucide-react";
import { useMemo, useState } from "react";
import SchoolLogo from "../components/SchoolLogo";
import { POLL_MONTHS, SEASONS } from "../lib/platformData";
import { createStandingsCsv, formatDivision } from "../lib/standingsPresentation";
import type { PollResult, Program, Standing } from "../types/platform";
import type { Gender, Weapon } from "../types/types";

type Props = {
    initialWeapon?: Weapon;
    programs: Program[];
    standings: Standing[];
    pollResults: PollResult[];
    season: string;
    onSeasonChange: (season: string) => void;
};

type SortKey = "rank" | "school" | "division" | "conference" | "region" | "spi";
type Sort = { key: SortKey; direction: "asc" | "desc" };

export default function StandingsPage({ initialWeapon = "Team", programs, standings, pollResults, season, onSeasonChange }: Props) {
    const [selection, setSelection] = useState<Weapon>(initialWeapon);
    const [gender, setGender] = useState<Gender>("Men");
    const [division, setDivision] = useState<"All" | "1" | "3">("All");
    const [region, setRegion] = useState("All");
    const [conference, setConference] = useState("All");
    const [sorts, setSorts] = useState<Sort[]>([{ key: "spi", direction: "desc" }]);
    const mode = selection === "Team" ? "Team" : "Squad";

    const rows: Array<{ standing: Standing; program: Program; rank: number }> = useMemo(() => {
        const joined = standings
            .filter((row) => row.weapon === selection)
            .map((standing) => ({ standing, program: programs.find((item) => item.id === standing.teamId) }))
            .filter((row): row is { standing: Standing; program: Program } => Boolean(row.program))
            .filter(({ standing, program }) =>
                standing.gender === gender &&
                (division === "All" || program.division === division) &&
                (region === "All" || program.region === region) &&
                (conference === "All" || program.conference === conference)
            );
        joined.sort((a, b) => compareRows(a, b, sorts));
        return joined.map((row, index) => ({ ...row, rank: index + 1 }));
    }, [conference, division, gender, programs, region, selection, sorts, standings]);

    const regions = unique(programs.map((program) => program.region));
    const conferences = unique(programs.map((program) => program.conference));

    function downloadSelection() {
        const csv = createStandingsCsv({
            downloadedAt: new Date(), season, gender, selection, division, region, conference,
            rows: rows.map(({ rank, standing, program }) => ({
                rank,
                school: program.name,
                division: program.division,
                conference: program.conference,
                region: program.region,
                spi: standing.spi,
            })),
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        link.download = `${season}-${selection.toLowerCase()}-standings.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    return (
        <section className="page-section standings-page">
            <div className="page-title-row">
                <div><p className="eyebrow">{season} season</p><h1>{mode} SPI</h1></div>
                <button className="button secondary" type="button" onClick={downloadSelection} disabled={!rows.length}>
                    <Download size={17} /> Download selection
                </button>
            </div>

            <div className="filter-bar" aria-label="Standings filters">
                <Filter label="Season" value={season} onChange={onSeasonChange} options={SEASONS.map((item) => [item.slug, item.name])} />
                <Filter label="Gender" value={gender} onChange={(value) => setGender(value as Gender)} options={["Men", "Women"]} />
                <Filter label="Team/Squad" value={selection} onChange={(value) => setSelection(value as Weapon)} options={["Team", "Epee", "Foil", "Sabre"]} />
                <Filter label="Division" value={division} onChange={(value) => setDivision(value as typeof division)} options={[["All", "All"], ["1", "I"], ["3", "III"]]} />
                <Filter label="Region" value={region} onChange={setRegion} options={["All", ...regions]} />
                <Filter label="Conference" value={conference} onChange={setConference} options={["All", ...conferences]} />
            </div>

            <div className="data-summary"><strong>{rows.length}</strong> programs <span>Click another heading to add a secondary sort.</span></div>
            <div className="platform-table-wrap">
                <table className="platform-table standings-table">
                    <thead><tr>
                        <SortHeader label="Rank" sortKey="rank" sorts={sorts} setSorts={setSorts} />
                        <th aria-label="Logo" />
                        <SortHeader label="School" sortKey="school" sorts={sorts} setSorts={setSorts} />
                        <SortHeader label="Division" sortKey="division" sorts={sorts} setSorts={setSorts} />
                        <SortHeader label="Conference" sortKey="conference" sorts={sorts} setSorts={setSorts} />
                        <SortHeader label="Region" sortKey="region" sorts={sorts} setSorts={setSorts} />
                        {POLL_MONTHS.map((month) => <th key={month}>{month.slice(0, 3)} poll</th>)}
                        <SortHeader label="SPI" sortKey="spi" sorts={sorts} setSorts={setSorts} />
                        <th>Results</th>
                    </tr></thead>
                    <tbody>{rows.length ? rows.map(({ rank, standing, program }) => (
                        <tr key={`${standing.teamId}-${standing.weapon}`}>
                            <td className="numeric rank-cell">{rank}</td><td><SchoolLogo program={program} size="small" /></td>
                            <td className="school-cell">{program.name}</td>
                            <td>{formatDivision(program.division)}</td>
                            <td>{program.conference}</td><td>{program.region}</td>
                            {POLL_MONTHS.map((month) => <td className="numeric muted" key={month}>{pollResults.find((result) => result.teamId === program.id && result.month === month && result.gender === standing.gender && result.weapon === standing.weapon && result.scope === (division === "3" ? "DIII" : "Overall"))?.rank ?? "—"}</td>)}
                            <td className="numeric spi-cell">{formatNumber(standing.spi)}</td>
                            <td><a className="icon-text-link" href={`#/schools/${program.id}/results?season=${season}`}><List size={16} /> View</a></td>
                        </tr>
                    )) : <tr><td className="empty-table" colSpan={12}>No standings are loaded for this selection.</td></tr>}</tbody>
                </table>
            </div>
        </section>
    );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<string | [string, string]> }) {
    return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => {
        const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
        return <option value={optionValue} key={optionValue}>{optionLabel}</option>;
    })}</select></label>;
}

function SortHeader({ label, sortKey, sorts, setSorts }: { label: string; sortKey: SortKey; sorts: Sort[]; setSorts: React.Dispatch<React.SetStateAction<Sort[]>> }) {
    const index = sorts.findIndex((sort) => sort.key === sortKey);
    return <th><button className="table-sort" type="button" onClick={() => setSorts((current) => nextSort(current, sortKey))}>
        {label}{index >= 0 && <span>{index + 1}{sorts[index].direction === "asc" ? "▲" : "▼"}</span>}
    </button></th>;
}

function nextSort(sorts: Sort[], key: SortKey): Sort[] {
    const current = sorts.find((sort) => sort.key === key);
    const initial = ["spi", "rank"].includes(key) ? "desc" : "asc";
    if (!current) return [{ key, direction: initial }, ...sorts];
    if (current.direction === initial) return [{ key, direction: initial === "asc" ? "desc" : "asc" }, ...sorts.filter((sort) => sort.key !== key)];
    return sorts.filter((sort) => sort.key !== key);
}

function compareRows(a: { standing: Standing; program: Program }, b: { standing: Standing; program: Program }, sorts: Sort[]) {
    for (const sort of sorts) {
        const av = valueForSort(a, sort.key); const bv = valueForSort(b, sort.key);
        const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        if (comparison) return sort.direction === "asc" ? comparison : -comparison;
    }
    return a.program.name.localeCompare(b.program.name);
}

function valueForSort(row: { standing: Standing; program: Program }, key: SortKey): string | number {
    if (key === "spi" || key === "rank") return row.standing.spi;
    if (key === "school") return row.program.name;
    return row.program[key];
}

function unique(values: string[]) { return [...new Set(values)].sort(); }
function formatNumber(value: number) { return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""); }
