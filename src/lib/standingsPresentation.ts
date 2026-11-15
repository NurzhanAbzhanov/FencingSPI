import type { Gender, Weapon } from "../types/types";
import type { SeasonMatch } from "../types/platform";

export type WinLossRecord = { wins: number; losses: number; ties: number };

export function createWinLossRecords(matches: SeasonMatch[], weapon: Weapon): Map<number, WinLossRecord> {
    const records = new Map<number, WinLossRecord>();
    for (const match of matches) {
        const left = weapon === 'Team' ? match.leftEpee + match.leftFoil + match.leftSabre
            : weapon === 'Epee' ? match.leftEpee : weapon === 'Foil' ? match.leftFoil : match.leftSabre;
        const right = weapon === 'Team' ? match.rightEpee + match.rightFoil + match.rightSabre
            : weapon === 'Epee' ? match.rightEpee : weapon === 'Foil' ? match.rightFoil : match.rightSabre;
        if (left + right === 0) continue;
        for (const [teamId, scoreFor, scoreAgainst] of [
            [match.leftTeamId, left, right], [match.rightTeamId, right, left],
        ]) {
            const record = records.get(teamId) ?? { wins: 0, losses: 0, ties: 0 };
            if (scoreFor > scoreAgainst) record.wins++;
            else if (scoreFor < scoreAgainst) record.losses++;
            else record.ties++;
            records.set(teamId, record);
        }
    }
    return records;
}

export function formatWinLossRecord(record?: WinLossRecord): string {
    if (!record) return '—';
    return `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}`;
}

export type StandingsCsvRow = {
    rank: number | null;
    school: string;
    division: string;
    conference: string;
    region: string;
    spi: number | null;
    record?: string;
    includedResults?: number;
    excludedResults?: number;
    isProvisional?: boolean;
};

type StandingsCsvOptions = {
    downloadedAt: Date;
    season: string;
    gender: Gender;
    selection: Weapon;
    division: string;
    region: string;
    conference: string;
    rows: StandingsCsvRow[];
    includeCoverage?: boolean;
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
        ["Gender", options.gender],
        ["Team/Squad", options.selection],
        ["Division", options.division === "All" ? "All" : formatDivision(options.division)],
        ["Region", options.region],
        ["Conference", options.conference],
    ];
    const headers = ["Rank", "School", "Division", "Conference", "Region", "SPI", "W-L"];
    if (options.includeCoverage) headers.push('Included results', 'Excluded results', 'Provisional');
    const table = options.rows.map((row) => [
        row.rank ?? '',
        row.school,
        formatDivision(row.division),
        row.conference,
        row.region,
        row.spi ?? '',
        row.record ?? '',
        ...(options.includeCoverage ? [row.includedResults ?? 0, row.excludedResults ?? 0, row.isProvisional ? 'Yes' : 'No'] : []),
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
