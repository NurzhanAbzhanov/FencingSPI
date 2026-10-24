import { describe, expect, it } from "vitest";
import { createPollResultsCsv, createPollReportCsv } from "./pollCsv";

describe("createPollResultsCsv", () => {
    it("quotes school names and exports the selected category only", () => {
        const csv = createPollResultsCsv([{
            rank: 1,
            teamId: 32,
            teamName: "Columbia University-Barnard College",
            points: 120,
            firstPlaceVotes: 4,
        }]);
        expect(csv).toContain('1,"Columbia University-Barnard College",120,4');
    });
});

describe('createPollReportCsv', () => {
    it('separates categories with labels, headers and download metadata', () => {
        const row = { rank: 1, teamId: 1, teamName: 'School, One', points: 15, firstPlaceVotes: 1 };
        const csv = createPollReportCsv([
            { label: "Men's Team Overall", standings: [row] },
            { label: "Women's Foil Overall", standings: [] },
        ], { poll: 'October (2026-27)', selection: 'All Categories', downloadedAt: new Date('2026-10-24T12:00:00Z') });
        expect(csv).toContain('"Poll","October (2026-27)"');
        expect(csv).toContain('2026-10-24T12:00:00.000Z');
        expect(csv).toContain('"Selection","All Categories"');
        expect(csv).toContain('"Category","Men\'s Team Overall"');
        expect(csv).toContain('"Category","Women\'s Foil Overall"');
        expect(csv.match(/"First-place votes"/g)).toHaveLength(2);
        expect(csv).toContain('1,"School, One",15,1');
        expect(csv).toContain('No votes recorded');
    });
});
