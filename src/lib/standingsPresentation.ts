import type { Gender, Weapon } from "../types/types";

export type StandingsView = "Team" | "Squad";

export type StandingsCsvRow = {
    rank: number;
    school: string;
    gender: Gender;
    weapon: Weapon;
    division: string;
    conference: string;
    region: string;
    spi: number;
};

type StandingsCsvOptions = {
    downloadedAt: Date;
    season: string;
    mode: StandingsView;
    gender: Gender;
    weapon: "All" | Exclude<Weapon, "Team">;
    division: string;
    region: string;
    conference: string;
    rows: StandingsCsvRow[];
};

const DIVISION_LABELS: Record<string, string> = {
    "1": "I",
    "2": "II",
    "3": "III",
};

export function formatDivision(division: string): string {
    return DIVISION_LABELS[division] ?? division;
}

export function createStandingsCsv(options: StandingsCsvOptions): string {
    const metadata: Array<[string, string]> = [
        ["Downloaded at", options.downloadedAt.toISOString()],
        ["Season", options.season],
        ["View", options.mode],
        ["Gender", options.gender],
        ...(options.mode === "Squad" ? [["Squad", options.weapon] as [string, string]] : []),
        ["Division", options.division === "All" ? "All" : formatDivision(options.division)],
        ["Region", options.region],
        ["Conference", options.conference],
    ];
    const headers = ["Rank", "School", "Gender", "Squad", "Division", "Conference", "Region", "SPI"];
    const table = options.rows.map((row) => [
        row.rank,
        row.school,
        row.gender,
        row.weapon,
        formatDivision(row.division),
        row.conference,
        row.region,
        row.spi,
    ]);

    return [
        ...metadata.map((row) => row.map(csvCell).join(",")),
        "",
        [headers, ...table].map((row) => row.map(csvCell).join(",")).join("\n"),
    ].join("\n");
}

function csvCell(value: string | number): string {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
