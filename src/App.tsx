import { useEffect, useState } from "react";
import Header from "./components/Header";
import ResultsTable, { type SpiResultRow } from "./components/ResultsTable";
import {
    readMatchSubmissions,
    saveMatchSubmissions,
} from "./lib/matchResultsStore";
import { TEAMS } from "./lib/teams";
import RegenerateDataPage from "./pages/RegenerateDataPage";
import ResultsEntryPage from "./pages/ResultsEntryPage";
import type { MatchSubmission } from "./types/types";
import "./App.css";

type Page =
    | "enter-results"
    | "team-spi"
    | "squad-spi"
    | "regenerate-data";

type GenderFilter = "All" | "Men" | "Women";
type WeaponFilter = "All" | "Epee" | "Foil" | "Sabre";

const GENERATED_SPI_ROWS_STORAGE_KEY = "generated-spi-rows-v6-2025-26";

export default function App(){
    const [page, setPage] = useState<Page>(getPageFromHash);
    const [teamGender, setTeamGender] = useState<GenderFilter>("All");
    const [squadGender, setSquadGender] = useState<GenderFilter>("All");
    const [squadWeapon, setSquadWeapon] = useState<WeaponFilter>("All");
    const [generatedRows, setGeneratedRows] = useState<SpiResultRow[]>(
        readGeneratedRowsFromStorage
    );
    const [matchSubmissions, setMatchSubmissions] = useState<MatchSubmission[]>(
        readMatchSubmissions
    );

    function handleRowsGenerated(rows: SpiResultRow[]) {
        setGeneratedRows(rows);
        localStorage.setItem(GENERATED_SPI_ROWS_STORAGE_KEY, JSON.stringify(rows));
    }

    function handleMatchSubmissionsChange(rows: MatchSubmission[]) {
        setMatchSubmissions(rows);
        saveMatchSubmissions(rows);
    }

    useEffect(() => {
        function handleHashChange() {
            setPage(getPageFromHash());
        }

        window.addEventListener("hashchange", handleHashChange);

        return () => {
            window.removeEventListener("hashchange", handleHashChange);
        };
    }, []);

    return (
        <>
            <Header activePage={page} />
            <main className="app-shell">
                {page === "enter-results" ? (
                    <ResultsEntryPage
                        submissions={matchSubmissions}
                        teams={TEAMS}
                        onSubmissionsChange={handleMatchSubmissionsChange}
                    />
                ) : page === "team-spi" ? (
                    <section className="page-section">
                        <div className="page-header">
                            <h1>Team SPI</h1>
                            <div className="filters">
                                <label>
                                    Gender
                                    <select
                                        value={teamGender}
                                        onChange={(event) =>
                                            setTeamGender(
                                                event.target.value as GenderFilter
                                            )
                                        }
                                    >
                                        <option>All</option>
                                        <option>Men</option>
                                        <option>Women</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                        <ResultsTable
                            csvPath={
                                generatedRows.length === 0
                                    ? "/spi-results.csv"
                                    : undefined
                            }
                            rows={
                                generatedRows.length > 0 ? generatedRows : undefined
                            }
                            filter={(row) => isTeamRow(row, teamGender)}
                            hiddenColumns={["weapon"]}
                        />
                    </section>
                ) : page === "squad-spi" ? (
                    <section className="page-section">
                        <div className="page-header">
                            <h1>Squad SPI</h1>
                            <div className="filters">
                                <label>
                                    Gender
                                    <select
                                        value={squadGender}
                                        onChange={(event) =>
                                            setSquadGender(
                                                event.target.value as GenderFilter
                                            )
                                        }
                                    >
                                        <option>All</option>
                                        <option>Men</option>
                                        <option>Women</option>
                                    </select>
                                </label>

                                <label>
                                    Weapon
                                    <select
                                        value={squadWeapon}
                                        onChange={(event) =>
                                            setSquadWeapon(
                                                event.target.value as WeaponFilter
                                            )
                                        }
                                    >
                                        <option>All</option>
                                        <option>Epee</option>
                                        <option>Foil</option>
                                        <option>Sabre</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                        <ResultsTable
                            csvPath={
                                generatedRows.length === 0
                                    ? "/spi-results.csv"
                                    : undefined
                            }
                            rows={
                                generatedRows.length > 0 ? generatedRows : undefined
                            }
                            filter={(row) =>
                                isSquadRow(row, squadGender, squadWeapon)
                            }
                        />
                    </section>
                ) : page === "regenerate-data" ? (
                    <RegenerateDataPage
                        enteredMatches={matchSubmissions}
                        onRowsGenerated={handleRowsGenerated}
                    />
                ) : (
                    <TeamSpiRedirect />
                )}
            </main>
        </>
    );
}

function TeamSpiRedirect() {
    window.location.hash = "#/team-spi";
    return null;
}

function getPageFromHash(): Page {
    const hash = window.location.hash.replace("#/", "");

    if (
        hash === "enter-results" ||
        hash === "squad-spi" ||
        hash === "regenerate-data"
    ) {
        return hash;
    }

    return "team-spi";
}

function readGeneratedRowsFromStorage(): SpiResultRow[] {
    const storedRows = localStorage.getItem(GENERATED_SPI_ROWS_STORAGE_KEY);

    if (!storedRows) {
        return [];
    }

    try {
        const parsedRows = JSON.parse(storedRows) as unknown;

        if (!Array.isArray(parsedRows)) {
            return [];
        }

        return parsedRows.filter(isSpiResultRow);
    } catch {
        return [];
    }
}

function isSpiResultRow(row: unknown): row is SpiResultRow {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
        return false;
    }

    const possibleRow = row as Partial<Record<keyof SpiResultRow, unknown>>;

    return (
        typeof possibleRow.teamId === "string" &&
        typeof possibleRow.teamName === "string" &&
        typeof possibleRow.gender === "string" &&
        typeof possibleRow.weapon === "string" &&
        typeof possibleRow.spi === "string"
    );
}

function isTeamRow(row: SpiResultRow, gender: GenderFilter): boolean {
    if (row.weapon !== "Team") {
        return false;
    }

    if (gender !== "All" && row.gender !== gender) {
        return false;
    }

    return true;
}

function isSquadRow(
    row: SpiResultRow,
    gender: GenderFilter,
    weapon: WeaponFilter
): boolean {
    if (row.weapon === "Team") {
        return false;
    }

    if (gender !== "All" && row.gender !== gender) {
        return false;
    }

    if (weapon !== "All" && row.weapon !== weapon) {
        return false;
    }

    return true;
}
