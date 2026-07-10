import { useEffect, useMemo, useState } from "react";

export type SpiResultRow = {
    teamId: string;
    teamName: string;
    gender: string;
    weapon: string;
    spi: string;
    prc: string;
    lowWinPct: string;
    mediumWinPct: string;
    highWinPct: string;
    lowScore: string;
    mediumScore: string;
    highScore: string;
    lowStrength?: string;
    mediumStrength?: string;
    highStrength?: string;
};

type SortDirection = "asc" | "desc";

type SortState = {
    column: keyof SpiResultRow;
    direction: SortDirection;
};

type SortStates = SortState[];

type ResultsTableProps = {
    csvPath?: string;
    rows?: SpiResultRow[];
    filter?: (row: SpiResultRow) => boolean;
    hiddenColumns?: Array<keyof SpiResultRow>;
};

const DISPLAY_COLUMNS: Array<keyof SpiResultRow> = [
    "teamId",
    "teamName",
    "gender",
    "weapon",
    "spi",
    "prc",
    "lowWinPct",
    "mediumWinPct",
    "highWinPct",
    "lowScore",
    "mediumScore",
    "highScore",
];

const COLUMN_LABELS: Record<keyof SpiResultRow, string> = {
    teamId: "ID",
    teamName: "Team",
    gender: "Gender",
    weapon: "Weapon",
    spi: "SPI",
    prc: "PRC",
    lowWinPct: "Low %",
    mediumWinPct: "Medium %",
    highWinPct: "High %",
    lowScore: "Low Score",
    mediumScore: "Medium Score",
    highScore: "High Score",
    lowStrength: "Low Strength",
    mediumStrength: "Medium Strength",
    highStrength: "High Strength",
};

const NUMERIC_COLUMNS = new Set<keyof SpiResultRow>([
    "teamId",
    "spi",
    "prc",
    "lowWinPct",
    "mediumWinPct",
    "highWinPct",
    "lowScore",
    "mediumScore",
    "highScore",
    "lowStrength",
    "mediumStrength",
    "highStrength",
]);

export default function ResultsTable({
    csvPath,
    rows: providedRows,
    filter,
    hiddenColumns = [],
}: ResultsTableProps) {
    const [rows, setRows] = useState<SpiResultRow[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        providedRows ? "ready" : "loading"
    );
    const [sorts, setSorts] = useState<SortStates>([
        {
            column: "spi",
            direction: "desc",
        },
    ]);

    useEffect(() => {
        if (providedRows) {
            setRows(providedRows);
            setStatus("ready");
            return;
        }

        if (!csvPath) {
            setRows([]);
            setStatus("ready");
            return;
        }

        let isMounted = true;

        setStatus("loading");

        fetch(csvPath)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Could not load SPI results.");
                }

                return response.text();
            })
            .then((csv) => {
                if (isMounted) {
                    setRows(parseCsv(csv));
                    setStatus("ready");
                }
            })
            .catch(() => {
                if (isMounted) {
                    setStatus("error");
                }
            });

        return () => {
            isMounted = false;
        };
    }, [csvPath, providedRows]);

    const sortedRows = useMemo(
        () => {
            const filteredRows = filter ? rows.filter(filter) : rows;

            return [...filteredRows].sort((a, b) => {
                for (const sort of sorts) {
                    const comparison = compareValues(a, b, sort.column);

                    if (comparison !== 0) {
                        return sort.direction === "asc" ? comparison : -comparison;
                    }
                }

                return 0;
            });
        },
        [filter, rows, sorts]
    );
    const visibleColumns = useMemo(
        () =>
            DISPLAY_COLUMNS.filter(
                (column) => !hiddenColumns.includes(column)
            ),
        [hiddenColumns]
    );

    if (status === "loading") {
        return <div className="table-state">Loading results</div>;
    }

    if (status === "error") {
        return <div className="table-state">Results unavailable</div>;
    }

    return (
        <div className="results-table-wrap">
            <table className="results-table">
                <thead>
                    <tr>
                        {visibleColumns.map((column) => (
                            <th key={column}>
                                <button
                                    className="sort-button"
                                    type="button"
                                    aria-label={getSortAriaLabel(sorts, column)}
                                    onClick={() =>
                                        setSorts((currentSorts) =>
                                            nextSorts(currentSorts, column)
                                        )
                                    }
                                >
                                    <span>{COLUMN_LABELS[column]}</span>
                                    {getSortIndicator(sorts, column) && (
                                        <span
                                            aria-hidden="true"
                                            className="sort-indicator"
                                        >
                                            {getSortIndicator(sorts, column)}
                                        </span>
                                    )}
                                </button>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.length > 0 ? (
                        sortedRows.map((row) => (
                            <tr key={`${row.teamId}-${row.gender}-${row.weapon}`}>
                                {visibleColumns.map((column) => (
                                    <td key={column}>{row[column]}</td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={visibleColumns.length}>No rows</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function parseCsv(csv: string): SpiResultRow[] {
    const lines = csv.trim().split(/\r?\n/);

    if (lines.length < 2) {
        return [];
    }

    const headers = splitCsvLine(lines[0]);

    return lines.slice(1).map((line) => {
        const values = splitCsvLine(line);
        const row = {} as SpiResultRow;

        headers.forEach((header, index) => {
            row[header as keyof SpiResultRow] = values[index] ?? "";
        });

        return row;
    });
}

function nextSorts(
    currentSorts: SortStates,
    column: keyof SpiResultRow
): SortStates {
    const existingSort = currentSorts.find((sort) => sort.column === column);
    const initialDirection = getInitialSortDirection(column);

    if (!existingSort) {
        return [
            {
                column,
                direction: initialDirection,
            },
            ...currentSorts,
        ];
    }

    if (existingSort.direction === initialDirection) {
        return [
            {
                column,
                direction: getOppositeSortDirection(initialDirection),
            },
            ...currentSorts.filter((sort) => sort.column !== column),
        ];
    }

    return currentSorts.filter((sort) => sort.column !== column);
}

function getNextSortDirection(
    sorts: SortStates,
    column: keyof SpiResultRow
): SortDirection {
    const existingSort = sorts.find((sort) => sort.column === column);

    if (!existingSort) {
        return getInitialSortDirection(column);
    }

    return getOppositeSortDirection(existingSort.direction);
}

function getSortAriaLabel(
    sorts: SortStates,
    column: keyof SpiResultRow
): string {
    const existingIndex = sorts.findIndex((sort) => sort.column === column);

    if (
        existingIndex !== -1 &&
        sorts[existingIndex].direction !==
            getInitialSortDirection(sorts[existingIndex].column)
    ) {
        return `Remove ${COLUMN_LABELS[column]} sort`;
    }

    return `Sort by ${COLUMN_LABELS[column]} ${getNextSortDirection(
        sorts,
        column
    )}`;
}

function getInitialSortDirection(column: keyof SpiResultRow): SortDirection {
    return NUMERIC_COLUMNS.has(column) ? "desc" : "asc";
}

function getOppositeSortDirection(direction: SortDirection): SortDirection {
    return direction === "asc" ? "desc" : "asc";
}

function getSortIndicator(
    sorts: SortStates,
    column: keyof SpiResultRow
): string {
    const index = sorts.findIndex((sort) => sort.column === column);

    if (index === -1) {
        return "";
    }

    const sort = sorts[index];
    const directionIndicator = sort.direction === "asc" ? "▲" : "▼";

    return `${index + 1}${directionIndicator}`;
}

function compareValues(
    a: SpiResultRow,
    b: SpiResultRow,
    column: keyof SpiResultRow
): number {
    if (NUMERIC_COLUMNS.has(column)) {
        return Number(a[column] ?? 0) - Number(b[column] ?? 0);
    }

    return String(a[column] ?? "").localeCompare(String(b[column] ?? ""));
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
