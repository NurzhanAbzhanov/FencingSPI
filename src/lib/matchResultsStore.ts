import type { MatchSubmission } from "../types/types";

const MATCH_RESULTS_STORAGE_KEY = "entered-match-results-v1";

export function readMatchSubmissions(): MatchSubmission[] {
    const stored = localStorage.getItem(MATCH_RESULTS_STORAGE_KEY);

    if (!stored) {
        return [];
    }

    try {
        const parsed = JSON.parse(stored) as unknown;

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(isMatchSubmission);
    } catch {
        return [];
    }
}

export function saveMatchSubmissions(rows: MatchSubmission[]): void {
    localStorage.setItem(MATCH_RESULTS_STORAGE_KEY, JSON.stringify(rows));
}

export function createMatchId(rows: MatchSubmission[]): number {
    const latestId = rows.reduce((highest, row) => Math.max(highest, row.id), 0);
    const timestampId = Date.now();

    return Math.max(latestId + 1, timestampId);
}

export function downloadMatchSubmissions(rows: MatchSubmission[]): void {
    const csv = toCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = "entered-match-results.csv";
    link.click();
    URL.revokeObjectURL(url);
}

function isMatchSubmission(value: unknown): value is MatchSubmission {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const row = value as Partial<MatchSubmission>;

    return (
        typeof row.id === "number" &&
        typeof row.timestamp === "string" &&
        typeof row.date === "string" &&
        (row.gender === "Men" || row.gender === "Women") &&
        typeof row.leftTeamId === "number" &&
        typeof row.rightTeamId === "number" &&
        typeof row.leftSabre === "number" &&
        typeof row.leftFoil === "number" &&
        typeof row.leftEpee === "number" &&
        typeof row.rightSabre === "number" &&
        typeof row.rightFoil === "number" &&
        typeof row.rightEpee === "number" &&
        typeof row.host === "string" &&
        typeof row.email === "string"
    );
}

function toCsv(rows: MatchSubmission[]): string {
    const headers = [
        "id",
        "Timestamp",
        "Date",
        "Gender",
        "L_Team",
        "L_Saber",
        "L_Foil",
        "L_Epee",
        "R_Team",
        "R_Saber",
        "R_Foil",
        "R_Epee",
        "host",
        "email",
    ];
    const lines = rows.map((row) =>
        [
            row.id,
            row.timestamp,
            row.date,
            row.gender,
            row.leftTeamId,
            row.leftSabre,
            row.leftFoil,
            row.leftEpee,
            row.rightTeamId,
            row.rightSabre,
            row.rightFoil,
            row.rightEpee,
            row.host,
            row.email,
        ]
            .map(escapeCsvValue)
            .join(",")
    );

    return `${[headers.join(","), ...lines].join("\n")}\n`;
}

function escapeCsvValue(value: string | number): string {
    const text = String(value);

    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
}
