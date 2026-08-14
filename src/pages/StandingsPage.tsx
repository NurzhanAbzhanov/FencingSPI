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
    const [sort, setSort] = useState<Sort>({ key: "spi", direction: "desc" });
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
        joined.sort((a, b) => compareRows(a, b, sort));
        return joined.map((row, index) => ({ ...row, rank: index + 1 }));
    }, [conference, division, gender, programs, region, selection, sort, standings]);

    const regions = unique(programs.map((program) => program.region));
    const conferences = unique(programs.map((program) => program.conference));

    function handleSort(key: SortKey) {
        setSort((current) => {
            if (current.key === key) {
                return { key, direction: current.direction === "asc" ? "desc" : "asc" };
            }
            const initial = ["spi", "rank"].includes(key) ? "desc" : "asc";
            return { key, direction: initial };
        });
    }

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

    const unitLabel = selection === "Team" ? "teams" : "squads";

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

            <div className="data-summary"><strong>{rows.length}</strong> total {unitLabel}</div>
            <div className="platform-table-wrap">
                <table className="platform-table standings-table" style={{ tableLayout: "fixed" }}>
                    <thead><tr>
                        <SortHeader label="Rank" sortKey="rank" sort={sort} onSort={handleSort} align="center" width="60px" />
                        <SortHeader label="School" sortKey="school" sort={sort} onSort={handleSort} align="left" width="300px" />
                        <SortHeader label="Division" sortKey="division" sort={sort} onSort={handleSort} align="center" width="85px" />
                        <SortHeader label="Conference" sortKey="conference" sort={sort} onSort={handleSort} align="left" width="160px" />
                        <SortHeader label="Region" sortKey="region" sort={sort} onSort={handleSort} align="left" width="160px" />
                        {POLL_MONTHS.map((month) => <th key={month} style={{ width: "75px", textAlign: "center" }}>{month.slice(0, 3)} poll</th>)}
                        <SortHeader label="SPI" sortKey="spi" sort={sort} onSort={handleSort} align="right" width="105px" />
                        <th style={{ textAlign: "center", width: "85px" }}>Results</th>
                    </tr></thead>
                    <tbody>{rows.length ? rows.map(({ rank, standing, program }) => (
                        <tr key={`${standing.teamId}-${standing.weapon}`}>
                            <td className="rank-cell text-center" style={{ textAlign: "center" }}>{rank}</td>
                            <td className="school-cell" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                                    <SchoolLogo program={program} size="small" />
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{program.name}</span>
                                </div>
                            </td>
                            <td className="text-center" style={{ textAlign: "center" }}>{formatDivision(program.division)}</td>
                            <td style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{program.conference}</td>
                            <td style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{program.region}</td>
                            {POLL_MONTHS.map((month) => (
                                <td className="numeric muted text-center" style={{ textAlign: "center" }} key={month}>
                                    {pollResults.find((result) => result.teamId === program.id && result.month === month && result.gender === standing.gender && result.weapon === standing.weapon && result.scope === (division === "3" ? "DIII" : "Overall"))?.rank ?? "—"}
                                </td>
                            ))}
                            <td className="numeric spi-cell" style={{ textAlign: "right" }}>{formatNumber(standing.spi)}</td>
                            <td style={{ textAlign: "center" }}>
                                <a className="icon-text-link" href={`#/schools/${program.id}/results?season=${season}`}>
                                    <List size={15} /> View
                                </a>
                            </td>
                        </tr>
                    )) : <tr><td className="empty-table" colSpan={11}>No standings are loaded for this selection.</td></tr>}</tbody>
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

function SortHeader({ label, sortKey, sort, onSort, align = "left", width }: { label: string; sortKey: SortKey; sort: Sort; onSort: (key: SortKey) => void; align?: "left" | "center" | "right"; width?: string }) {
    const isActive = sort.key === sortKey;
    const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
    return <th style={{ width, textAlign: align }}>
        <button 
            className="table-sort" 
            style={{ justifyContent: justify }}
            type="button" 
            onClick={() => onSort(sortKey)}
        >
            {label}
            {isActive && <span className="sort-arrow">{sort.direction === "asc" ? "▲" : "▼"}</span>}
        </button>
    </th>;
}

function compareRows(a: { standing: Standing; program: Program }, b: { standing: Standing; program: Program }, sort: Sort) {
    const av = valueForSort(a, sort.key); 
    const bv = valueForSort(b, sort.key);
    const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    if (comparison !== 0) return sort.direction === "asc" ? comparison : -comparison;
    return a.program.name.localeCompare(b.program.name);
}

function valueForSort(row: { standing: Standing; program: Program }, key: SortKey): string | number {
    if (key === "spi" || key === "rank") return row.standing.spi;
    if (key === "school") return row.program.name;
    return row.program[key];
}

function unique(values: string[]) { return [...new Set(values)].sort(); }
function formatNumber(value: number) { return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""); }
