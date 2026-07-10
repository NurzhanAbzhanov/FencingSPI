import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ResultsTable, { type SpiResultRow } from "../components/ResultsTable";
import { createPowerRatings } from "../lib/powerRatings";
import { calculateSPI } from "../lib/spi";
import type {
    FencerRatingRow,
    Gender,
    MatchRow,
    SquadPowerRating,
    Team,
    Weapon,
} from "../types/types";

type RawRow = Record<string, string>;

type InputKey =
    | "matches"
    | "teams"
    | "menRatings"
    | "womenRatings"
    | "dynamicPowerRatings";

type RegenerateOptions = {
    fillMissingPowerRatings: boolean;
    applyPennStateOverride: boolean;
    includeTeamRows: boolean;
    includeSquadRows: boolean;
};

type DynamicTeamPowerRating = {
    teamId: number;
    gender: Gender;
    rawPowerRating: number;
    adjustedPowerRating: number;
};

const INPUT_LABELS: Record<InputKey, string> = {
    matches: "Match rows",
    teams: "Teams",
    menRatings: "Men's fencer ratings",
    womenRatings: "Women's fencer ratings",
    dynamicPowerRatings: "Dynamic PR workbook",
};

const DEFAULT_OPTIONS: RegenerateOptions = {
    fillMissingPowerRatings: true,
    applyPennStateOverride: true,
    includeTeamRows: true,
    includeSquadRows: true,
};

type RegenerateDataPageProps = {
    onRowsGenerated: (rows: SpiResultRow[]) => void;
};

export default function RegenerateDataPage({
    onRowsGenerated,
}: RegenerateDataPageProps) {
    const [files, setFiles] = useState<Partial<Record<InputKey, File>>>({});
    const [options, setOptions] = useState<RegenerateOptions>(DEFAULT_OPTIONS);
    const [rows, setRows] = useState<SpiResultRow[]>([]);
    const [status, setStatus] = useState<string>("");
    const [isCalculating, setIsCalculating] = useState(false);

    const canCalculate = useMemo(
        () =>
            Boolean(
                files.matches &&
                    files.teams &&
                    files.menRatings &&
                    files.womenRatings &&
                    files.dynamicPowerRatings
            ),
        [files]
    );

    async function handleCalculate() {
        if (!canCalculate) {
            setStatus("Select all five input files.");
            return;
        }

        setIsCalculating(true);
        setStatus("");

        try {
            const [matchRows, teamRows, menRows, womenRows, dynamicTeamRatings] =
                await Promise.all([
                    readRowsFile(files.matches),
                    readRowsFile(files.teams),
                    readRowsFile(files.menRatings),
                    readRowsFile(files.womenRatings),
                    readDynamicTeamPowerRatings(files.dynamicPowerRatings),
                ]);
            const matches = matchRows.map(parseMatchRow);
            const teams = teamRows.map(parseTeamRow);
            const menFencerRatings = menRows.map(parseFencerRatingRow);
            const womenFencerRatings = womenRows.map(parseFencerRatingRow);
            const calculatedPowerRatings = [
                ...createPowerRatings(menFencerRatings, "Men", teams),
                ...createPowerRatings(womenFencerRatings, "Women", teams),
            ];
            const powerRatings = options.fillMissingPowerRatings
                ? fillMissingPowerRatings(calculatedPowerRatings, teams, matches)
                : calculatedPowerRatings;

            applyDynamicTeamPowerRatings(powerRatings, dynamicTeamRatings);

            if (options.applyPennStateOverride) {
                applyPowerRatingOverrides(powerRatings, [
                    {
                        teamId: 26,
                        gender: "Men",
                        weapon: "Team",
                        adjustedPowerRating: 90,
                    },
                ]);
            }

            const generatedRows = calculateSPI(matches, powerRatings)
                .filter((result) => {
                    if (result.weapon === "Team") {
                        return options.includeTeamRows;
                    }

                    return options.includeSquadRows;
                })
                .map((result) => {
                    const team = teams.find(
                        (team) =>
                            team.id === result.teamId &&
                            team.gender === result.gender
                    );

                    return {
                        teamId: String(result.teamId),
                        teamName: team?.name ?? "Unknown",
                        gender: result.gender,
                        weapon: result.weapon,
                        lowWinPct: round(result.lowWinPct),
                        mediumWinPct: round(result.mediumWinPct),
                        highWinPct: round(result.highWinPct),
                        lowStrength: round(result.lowCategoryStrength),
                        mediumStrength: round(result.mediumCategoryStrength),
                        highStrength: round(result.highCategoryStrength),
                        lowScore: round(result.lowScore),
                        mediumScore: round(result.mediumScore),
                        highScore: round(result.highScore),
                        prc: round(result.prc),
                        spi: round(result.spi),
                    };
                });

            setRows(generatedRows);
            onRowsGenerated(generatedRows);
            setStatus(
                `Generated ${generatedRows.length} SPI rows using ${dynamicTeamRatings.length} dynamic team power ratings. Team SPI and Squad SPI now use this dataset.`
            );
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Calculation failed.");
        } finally {
            setIsCalculating(false);
        }
    }

    function handleDownloadCsv() {
        const csv = toCsv(rows);
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const link = document.createElement("a");

        link.href = url;
        link.download = "spi-results.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <section className="page-section">
            <div className="page-header">
                <h1>Regenerate Data</h1>
            </div>

            <div className="regenerate-layout">
                <div className="input-panel">
                    {(Object.keys(INPUT_LABELS) as InputKey[]).map((inputKey) => (
                        <label className="file-input" key={inputKey}>
                            {INPUT_LABELS[inputKey]}
                            <input
                                accept={
                                    inputKey === "dynamicPowerRatings"
                                        ? ".xlsx,.xls"
                                        : ".csv,.tsv,.json"
                                }
                                type="file"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];

                                    setFiles((currentFiles) => ({
                                        ...currentFiles,
                                        [inputKey]: file,
                                    }));
                                }}
                            />
                        </label>
                    ))}
                </div>

                <div className="options-panel">
                    <label>
                        <input
                            checked={options.fillMissingPowerRatings}
                            type="checkbox"
                            onChange={(event) =>
                                setOptions((currentOptions) => ({
                                    ...currentOptions,
                                    fillMissingPowerRatings: event.target.checked,
                                }))
                            }
                        />
                        Fill missing power ratings with 0
                    </label>

                    <label>
                        <input
                            checked={options.applyPennStateOverride}
                            type="checkbox"
                            onChange={(event) =>
                                setOptions((currentOptions) => ({
                                    ...currentOptions,
                                    applyPennStateOverride: event.target.checked,
                                }))
                            }
                        />
                        Override Penn State Men Team PR to 90
                    </label>

                    <label>
                        <input
                            checked={options.includeTeamRows}
                            type="checkbox"
                            onChange={(event) =>
                                setOptions((currentOptions) => ({
                                    ...currentOptions,
                                    includeTeamRows: event.target.checked,
                                }))
                            }
                        />
                        Include Team rows
                    </label>

                    <label>
                        <input
                            checked={options.includeSquadRows}
                            type="checkbox"
                            onChange={(event) =>
                                setOptions((currentOptions) => ({
                                    ...currentOptions,
                                    includeSquadRows: event.target.checked,
                                }))
                            }
                        />
                        Include Squad rows
                    </label>

                    <div className="action-row">
                        <button
                            disabled={!canCalculate || isCalculating}
                            type="button"
                            onClick={handleCalculate}
                        >
                            {isCalculating ? "Calculating" : "Calculate"}
                        </button>
                        <button
                            disabled={rows.length === 0}
                            type="button"
                            onClick={handleDownloadCsv}
                        >
                            Download CSV
                        </button>
                    </div>
                </div>
            </div>

            {status && <div className="status-line">{status}</div>}

            {rows.length > 0 && <ResultsTable rows={rows} />}
        </section>
    );
}

async function readRowsFile(file?: File): Promise<RawRow[]> {
    if (!file) {
        throw new Error("Missing input file.");
    }

    const text = await file.text();

    if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text) as unknown;

        if (!Array.isArray(parsed)) {
            throw new Error(`${file.name} must contain an array of rows.`);
        }

        return parsed.map((row) => stringifyRawRow(row, file.name));
    }

    return parseDelimitedRows(text);
}

async function readDynamicTeamPowerRatings(
    file?: File
): Promise<DynamicTeamPowerRating[]> {
    if (!file) {
        throw new Error("Missing dynamic PR workbook.");
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });

    return [
        ...readDynamicSheet(workbook, "Dynamic M 2-11", "Men"),
        ...readDynamicSheet(workbook, "Dynamic W 2-11", "Women"),
    ];
}

function readDynamicSheet(
    workbook: XLSX.WorkBook,
    sheetName: string,
    gender: Gender
): DynamicTeamPowerRating[] {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
        throw new Error(`Missing sheet: ${sheetName}`);
    }

    const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
        defval: "",
        raw: false,
    });

    return rows
        .map((row) => normalizeRawRow(row))
        .filter((row) => row.id || row.idnumber)
        .map((row) => {
            const rawPowerRating = readOptionalNumber(row, "sp");
            const adjustedPowerRating = readNumber(row, "dynround");

            return {
                teamId: readNumber(row, "id", "idnumber"),
                gender,
                rawPowerRating: rawPowerRating ?? adjustedPowerRating,
                adjustedPowerRating,
            };
        });
}

function parseDelimitedRows(contents: string): RawRow[] {
    const lines = contents
        .split(/\r?\n/)
        .map((line) => line.replace(/\r$/, ""))
        .filter((line) => line.trim() !== "");
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = splitDelimitedLine(lines[0], delimiter).map(
        (header, index) => {
            const normalized = normalizeHeader(header);

            if (index === 0 && normalized === "") {
                return "id";
            }

            return normalized;
        }
    );

    return lines.slice(1).map((line) => {
        const values = splitDelimitedLine(line, delimiter);
        const row: RawRow = {};

        headers.forEach((header, index) => {
            if (header) {
                row[header] = values[index]?.trim() ?? "";
            }
        });

        return row;
    });
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
    if (delimiter === "\t") {
        return line.split("\t");
    }

    return splitCsvLine(line);
}

function splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = "";
    let isInsideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        const nextCharacter = line[index + 1];

        if (character === '"' && nextCharacter === '"') {
            currentValue += '"';
            index += 1;
            continue;
        }

        if (character === '"') {
            isInsideQuotes = !isInsideQuotes;
            continue;
        }

        if (character === "," && !isInsideQuotes) {
            values.push(currentValue);
            currentValue = "";
            continue;
        }

        currentValue += character;
    }

    values.push(currentValue);

    return values;
}

function stringifyRawRow(row: unknown, fileName: string): RawRow {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error(`JSON row must be an object in ${fileName}.`);
    }

    const rawRow: RawRow = {};

    for (const [key, value] of Object.entries(row)) {
        rawRow[normalizeHeader(key)] = String(value ?? "");
    }

    return rawRow;
}

function normalizeRawRow(row: RawRow): RawRow {
    const normalizedRow: RawRow = {};

    for (const [key, value] of Object.entries(row)) {
        normalizedRow[normalizeHeader(key)] = String(value ?? "");
    }

    return normalizedRow;
}

function parseMatchRow(row: RawRow, index: number): MatchRow {
    return {
        id: readOptionalNumber(row, "id") ?? index + 1,
        timestamp: readString(row, "timestamp"),
        date: readString(row, "date"),
        gender: parseGender(readString(row, "gender")),
        leftTeamId: readNumber(row, "leftteamid", "lteam"),
        rightTeamId: readNumber(row, "rightteamid", "rteam"),
        leftSabre: readNumber(row, "leftsabre", "leftsaber", "lsabre", "lsaber"),
        leftFoil: readNumber(row, "leftfoil", "lfoil"),
        leftEpee: readNumber(row, "leftepee", "lepee"),
        rightSabre: readNumber(
            row,
            "rightsabre",
            "rightsaber",
            "rsabre",
            "rsaber"
        ),
        rightFoil: readNumber(row, "rightfoil", "rfoil"),
        rightEpee: readNumber(row, "rightepee", "repee"),
        host: readString(row, "host"),
    };
}

function parseTeamRow(row: RawRow): Team {
    return {
        id: readNumber(row, "id", "teamid"),
        name: readString(row, "name", "teamname"),
        gender: parseGender(readString(row, "gender")),
    };
}

function parseFencerRatingRow(row: RawRow): FencerRatingRow {
    return {
        teamName: readString(row, "teamname", "name"),
        weapon: parseWeapon(readString(row, "weapon")),
        powerRating: readNumber(row, "powerrating", "pr"),
    };
}

function readString(row: RawRow, ...keys: string[]): string {
    for (const key of keys) {
        const value = row[normalizeHeader(key)];

        if (value !== undefined && value !== "") {
            return value.trim();
        }
    }

    throw new Error(`Missing required column: ${keys[0]}`);
}

function readNumber(row: RawRow, ...keys: string[]): number {
    const rawValue = readString(row, ...keys);
    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
        throw new Error(`Expected numeric value for ${keys[0]}, got "${rawValue}"`);
    }

    return value;
}

function readOptionalNumber(row: RawRow, ...keys: string[]): number | undefined {
    for (const key of keys) {
        const value = row[normalizeHeader(key)];

        if (value !== undefined && value !== "") {
            const parsed = Number(value);

            if (!Number.isFinite(parsed)) {
                throw new Error(`Expected numeric value for ${key}, got "${value}"`);
            }

            return parsed;
        }
    }

    return undefined;
}

function parseGender(value: string): Gender {
    if (value === "Men" || value === "Women") {
        return value;
    }

    throw new Error(`Invalid gender: ${value}`);
}

function parseWeapon(value: string): Exclude<Weapon, "Team"> {
    const normalized = value.trim().toLowerCase();

    if (normalized === "epee" || normalized === "épée") {
        return "Epee";
    }

    if (normalized === "foil") {
        return "Foil";
    }

    if (normalized === "sabre" || normalized === "saber") {
        return "Sabre";
    }

    throw new Error(`Invalid weapon: ${value}`);
}

function fillMissingPowerRatings(
    powerRatings: SquadPowerRating[],
    teams: Team[],
    matches: MatchRow[]
): SquadPowerRating[] {
    const completedPowerRatings = [...powerRatings];
    const weapons: Weapon[] = ["Epee", "Foil", "Sabre", "Team"];

    for (const team of teams) {
        const teamHasMatches = matches.some(
            (match) =>
                match.gender === team.gender &&
                (match.leftTeamId === team.id || match.rightTeamId === team.id)
        );

        if (!teamHasMatches) {
            continue;
        }

        for (const weapon of weapons) {
            const rating = completedPowerRatings.find(
                (powerRating) =>
                    powerRating.teamId === team.id &&
                    powerRating.gender === team.gender &&
                    powerRating.weapon === weapon
            );

            if (rating) {
                continue;
            }

            completedPowerRatings.push({
                teamId: team.id,
                gender: team.gender,
                weapon,
                rawPowerRating: 0,
                adjustedPowerRating: 0,
            });
        }
    }

    return completedPowerRatings;
}

function applyPowerRatingOverrides(
    powerRatings: SquadPowerRating[],
    overrides: Array<{
        teamId: number;
        gender: Gender;
        weapon: Weapon;
        adjustedPowerRating: number;
    }>
): void {
    for (const override of overrides) {
        const rating = powerRatings.find(
            (powerRating) =>
                powerRating.teamId === override.teamId &&
                powerRating.gender === override.gender &&
                powerRating.weapon === override.weapon
        );

        if (rating) {
            rating.rawPowerRating = override.adjustedPowerRating;
            rating.adjustedPowerRating = override.adjustedPowerRating;
            continue;
        }

        powerRatings.push({
            teamId: override.teamId,
            gender: override.gender,
            weapon: override.weapon,
            rawPowerRating: override.adjustedPowerRating,
            adjustedPowerRating: override.adjustedPowerRating,
        });
    }
}

function applyDynamicTeamPowerRatings(
    powerRatings: SquadPowerRating[],
    dynamicRatings: DynamicTeamPowerRating[]
): void {
    for (const dynamicRating of dynamicRatings) {
        const rating = powerRatings.find(
            (powerRating) =>
                powerRating.teamId === dynamicRating.teamId &&
                powerRating.gender === dynamicRating.gender &&
                powerRating.weapon === "Team"
        );

        if (rating) {
            rating.rawPowerRating = dynamicRating.rawPowerRating;
            rating.adjustedPowerRating = dynamicRating.adjustedPowerRating;
            continue;
        }

        powerRatings.push({
            teamId: dynamicRating.teamId,
            gender: dynamicRating.gender,
            weapon: "Team",
            rawPowerRating: dynamicRating.rawPowerRating,
            adjustedPowerRating: dynamicRating.adjustedPowerRating,
        });
    }
}

function normalizeHeader(header: string): string {
    return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function round(value: number): string {
    return value.toFixed(4).replace(/\.?0+$/, "");
}

function toCsv(rows: SpiResultRow[]): string {
    if (rows.length === 0) {
        return "";
    }

    const headers = Object.keys(rows[0]) as Array<keyof SpiResultRow>;
    const lines = [
        headers.join(","),
        ...rows.map((row) =>
            headers.map((header) => escapeCsvValue(row[header] ?? "")).join(",")
        ),
    ];

    return `${lines.join("\n")}\n`;
}

function escapeCsvValue(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replaceAll('"', '""')}"`;
    }

    return value;
}
