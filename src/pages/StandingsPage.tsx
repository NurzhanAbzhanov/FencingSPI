import { Download, List } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SchoolLogo from "../components/SchoolLogo";
import { teamProfileUrl } from "../lib/teamProfile";
import { POLL_MONTHS, SEASONS } from "../lib/platformData";
import { createStandingsCsv, formatDivision } from "../lib/standingsPresentation";
import type { PollResult, Program, Standing } from "../types/platform";
import type { Gender, Weapon } from "../types/types";

type Props = {
    onFiltersChange?: (filters: Record<string, string>) => void;
    loading?: boolean;
    loadError?: boolean;
    initialWeapon?: Weapon;
    programs: Program[];
    standings: Standing[];
    pollResults: PollResult[];
    season: string;
    onSeasonChange: (season: string) => void;
};

type SortKey = "rank" | "school" | "division" | "conference" | "region" | "spi";
type Sort = { key: SortKey; direction: "asc" | "desc" };
type DisplayStanding = Omit<Standing, 'spi'> & { spi: number | null };

export default function StandingsPage({ initialWeapon = "Team", programs, standings, pollResults, season, onSeasonChange, loading = false, loadError = false, onFiltersChange }: Props) {
    const [selection, setSelection] = useState<Weapon>(initialWeapon);
    const [gender, setGender] = useState<Gender>("Men");
    const [division, setDivision] = useState<"All" | "1" | "3">("All");
    const [region, setRegion] = useState("All");
    const [conference, setConference] = useState("All");
    const [sort, setSort] = useState<Sort>({ key: "spi", direction: "desc" });
    useEffect(() => {
        onFiltersChange?.({ gender, "team/squad": selection, division, region, conference, sort: `${sort.key} ${sort.direction}` });
    }, [gender, selection, division, region, conference, sort, onFiltersChange]);
    const mode = selection === "Team" ? "Team" : "Squad";
    const preseason = !loading && !loadError && season === "2026-27" && standings.length === 0;
    const selectedPolls = pollResults.filter((row) => row.gender === gender && row.weapon === selection && row.scope === (division === "3" ? "DIII" : "Overall"));
    const historicalPeriods = ["Preseason", "Midseason", "End-season"];
    const periodOrder = [...historicalPeriods, ...POLL_MONTHS];
    const periods = season === "2026-27" ? [...POLL_MONTHS] : selectedPolls.length
        ? [...new Set(selectedPolls.map((row) => row.month))].sort((a, b) => periodOrder.indexOf(a) - periodOrder.indexOf(b))
        : historicalPeriods;
    const sources = [...new Set(selectedPolls.map((row) => row.sourceUrl).filter((url): url is string => Boolean(url)))];
    const latestPollPeriod = [...periods].reverse().find((period) => selectedPolls.some((row) => row.month === period));
    const pollRank = (teamId: number) => selectedPolls.find((row) => row.teamId === teamId && row.month === latestPollPeriod)?.rank ?? null;

    function pollCell(teamId: number, period: string) {
        const result = selectedPolls.find((row) => row.teamId === teamId && row.month === period);
        if (!result) return "—";
        const tied = selectedPolls.some((row) => row.teamId !== teamId && row.month === period && row.rank === result.rank);
        return <span title={result.points == null ? "Points not published" : `${result.points} points`}>{tied ? "T" : ""}{result.rank}</span>;
    }

    const rows = useMemo(() => {
        const displayStandings: DisplayStanding[] = preseason ? programs.map((program) => ({
            teamId: program.id, teamName: program.name, gender: program.gender, weapon: selection, spi: null,
        })) : standings;
        const joined = displayStandings
            .filter((row) => row.weapon === selection)
            .map((standing) => ({ standing, program: programs.find((item) => item.id === standing.teamId) }))
            .filter((row): row is { standing: DisplayStanding; program: Program } => Boolean(row.program))
            .filter(({ standing, program }) =>
                standing.gender === gender &&
                (division === "All" || program.division === division) &&
                (region === "All" || program.region === region) &&
                (conference === "All" || program.conferences.includes(conference))
            );
        joined.sort((a, b) => {
            if (preseason && (sort.key === 'spi' || sort.key === 'rank')) {
                const ar = pollRank(a.program.id), br = pollRank(b.program.id);
                if (ar === null && br !== null) return 1;
                if (br === null && ar !== null) return -1;
                if (ar !== null && br !== null && ar !== br) return sort.direction === 'desc' ? ar - br : br - ar;
                return a.program.name.localeCompare(b.program.name);
            }
            return compareRows(a, b, sort);
        });
        return joined.map((row, index) => ({ ...row, rank: preseason ? pollRank(row.program.id) : index + 1 }));
    }, [conference, division, gender, programs, region, selection, sort, standings, preseason, pollResults]);

    const regions = unique([...programs.map((program) => program.region), ...(region === "All" ? [] : [region])]);
    const conferences = unique([...programs.flatMap((program) => program.conferences), ...(conference === "All" ? [] : [conference])]);

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
                conference: program.conferences.join(", "),
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
            {preseason && <p className="season-notice" role="status">{selectedPolls.length ? 'SPI and power ratings are not yet available. Rankings reflect the latest published coaches poll.' : 'Season not started'}</p>}
            <div className="platform-table-wrap">
                <table className="platform-table standings-table" style={{ tableLayout: "fixed" }}>
                    <thead><tr>
                        <SortHeader label="Rank" sortKey="rank" sort={sort} onSort={handleSort} align="center" width="60px" />
                        <SortHeader label="School" sortKey="school" sort={sort} onSort={handleSort} align="left" width="300px" />
                        <SortHeader label="Division" sortKey="division" sort={sort} onSort={handleSort} align="center" width="85px" />
                        <SortHeader label="Conference" sortKey="conference" sort={sort} onSort={handleSort} align="left" width="160px" />
                        <SortHeader label="Region" sortKey="region" sort={sort} onSort={handleSort} align="left" width="160px" />
                        {periods.map((month) => <th className="poll-column" key={month} style={{ width: "75px", textAlign: "center" }}>{historicalPeriods.includes(month) ? month : month.slice(0, 3)} poll</th>)}
                        <SortHeader label="SPI" sortKey="spi" sort={sort} onSort={handleSort} align="right" width="105px" />
                        <th style={{ textAlign: "center", width: "85px" }}>Results</th>
                    </tr></thead>
                    <tbody>{rows.length ? rows.map(({ rank, standing, program }) => (
                        <tr key={`${standing.teamId}-${standing.weapon}`}>
                            <td className="rank-cell text-center" style={{ textAlign: "center" }}>{rank ?? '—'}</td>
                            <td className="school-cell" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                                    <SchoolLogo program={program} size="small" />
                                    {teamProfileUrl(program.id) ? <a className="school-profile-link" href={teamProfileUrl(program.id)}
                                        target="_blank" rel="noopener noreferrer"
                                        title="USFCA team profile (opens in a new tab)"
                                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{program.name}</a>
                                        : <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{program.name}</span>}
                                </div>
                            </td>
                            <td className="text-center" style={{ textAlign: "center" }}>{formatDivision(program.division)}</td>
                            <td style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{program.conferences.join(", ")}</td>
                            <td style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{program.region}</td>
                            {periods.map((month) => (
                                <td className="numeric muted text-center" style={{ textAlign: "center" }} key={month}>
                                    {pollCell(program.id, month)}
                                </td>
                            ))}
                            <td className="numeric spi-cell" style={{ textAlign: "right" }}>{formatNumber(standing.spi)}</td>
                            <td style={{ textAlign: "center" }}>
                                <a className="icon-text-link" href={`#/schools/${program.id}/results?season=${season}`}>
                                    <List size={15} /> View
                                </a>
                            </td>
                        </tr>
                    )) : <tr><td className="empty-table" colSpan={7 + periods.length} role="status">{loading ? "Loading season data" : loadError ? "Season data unavailable. Try another season or refresh the page." : preseason ? "SPI will be available after competition results are entered." : "No standings are loaded for this selection."}</td></tr>}</tbody>
                </table>
            </div>
            {sources.length > 0 && <div className="poll-sources" aria-label="Published poll sources">Published polls: {sources.map((url, index) => <a href={url} key={url} target="_blank" rel="noreferrer">Source {index + 1}</a>)}</div>}
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

function compareRows(a: { standing: DisplayStanding; program: Program }, b: { standing: DisplayStanding; program: Program }, sort: Sort) {
    const av = valueForSort(a, sort.key); 
    const bv = valueForSort(b, sort.key);
    const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    if (comparison !== 0) return sort.direction === "asc" ? comparison : -comparison;
    return a.program.name.localeCompare(b.program.name);
}

function valueForSort(row: { standing: DisplayStanding; program: Program }, key: SortKey): string | number {
    if (key === "spi" || key === "rank") return row.standing.spi ?? 0;
    if (key === "school") return row.program.name;
    if (key === "conference") return row.program.conferences.join(", ");
    return row.program[key];
}

function unique(values: string[]) { return [...new Set(values)].sort(); }
function formatNumber(value: number | null) { return value === null ? '—' : value.toFixed(2); }
