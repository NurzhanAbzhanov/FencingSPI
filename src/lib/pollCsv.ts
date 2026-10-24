import type { PollStanding } from '../types/polls';

export function createPollResultsCsv(rows: PollStanding[]): string {
    return [
        ['Rank', 'School', 'Points', 'First-place votes'],
        ...rows.map((row) => [row.rank, row.teamName, row.points, row.firstPlaceVotes]),
    ].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function createPollReportCsv(
    sections: Array<{ label: string; standings: PollStanding[] }>,
    options: { poll: string; selection: string; downloadedAt?: Date },
): string {
    const lines: Array<Array<string | number>> = [
        ['USFCA Coaches Poll', '', '', ''],
        ['Poll', options.poll, '', ''],
        ['Downloaded (UTC)', (options.downloadedAt ?? new Date()).toISOString(), '', ''],
        ['Selection', options.selection, '', ''],
    ];
    for (const section of sections) {
        lines.push(['', '', '', ''], ['Category', section.label, '', ''],
            ['Rank', 'School', 'Points', 'First-place votes']);
        const standings = [...section.standings].sort((a, b) => a.rank - b.rank);
        if (!standings.length) lines.push(['No votes recorded', '', '', '']);
        for (const row of standings) lines.push([row.rank, row.teamName, row.points, row.firstPlaceVotes]);
    }
    return lines.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function createParticipationCsv(headers: string[], rows: Array<Array<string | number>>): string {
    return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: string | number): string {
    if (typeof value === 'number') return String(value);
    return `"${value.replaceAll('"', '""')}"`;
}

export function downloadCsv(filename: string, contents: string) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff', contents], { type: 'text/csv;charset=utf-8' }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}
