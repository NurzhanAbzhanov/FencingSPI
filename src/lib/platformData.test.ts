import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    from: vi.fn(),
}));

vi.mock("./supabase", () => ({
    supabase: { from: mocks.from },
}));

import {
    loadMatches,
    loadPollResults,
    loadPrograms,
    loadStandings,
    readLocalPrograms,
} from "./platformData";

function query(data: unknown, error: unknown = null) {
    const result = Promise.resolve({ data, error });
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "range", "limit"]) {
        builder[method] = vi.fn(() => builder);
    }
    builder.then = result.then.bind(result);
    return builder;
}

describe("readLocalPrograms", () => {
    it('caps published ranks on the SPI page without changing stored points', async () => {
        const base = { id: 1, team_id: 52, period: 'October', gender: 'Men', scope: 'Overall', points: 100, source_url: 'https://usfca.org/poll' };
        mocks.from.mockReturnValueOnce(query([
            { ...base, weapon: 'Team', rank: 15 }, { ...base, weapon: 'Team', rank: 16 },
            { ...base, weapon: 'Foil', rank: 15 }, { ...base, weapon: 'Foil', rank: 16 },
            { ...base, weapon: 'Epee', scope: 'DIII', rank: 8 }, { ...base, weapon: 'Epee', scope: 'DIII', rank: 9 },
            { ...base, weapon: 'Team', scope: 'DIII', rank: 10 }, { ...base, weapon: 'Team', scope: 'DIII', rank: 11 },
        ])).mockReturnValueOnce(query([]));
        const rows = await loadPollResults('2026-27');
        expect(rows.map((row) => row.rank)).toEqual([15, 15, 8, 10]);
        expect(rows.every((row) => row.points === 100)).toBe(true);
    });
    it("loads archived ranks without converting unpublished points to zero", async () => {
        mocks.from.mockReturnValueOnce(query([{
            id: 1, team_id: 52, period: "Preseason", gender: "Men", weapon: "Team", scope: "Overall", rank: 1, points: null, source_url: "https://usfca.org/poll.pdf",
        }])).mockReturnValueOnce(query([]));
        const results = await loadPollResults("2025-26");
        expect(results[0]).toMatchObject({ month: "Preseason", teamId: 52, rank: 1, points: null });
    });
    beforeEach(() => localStorage.clear());

    beforeEach(() => mocks.from.mockReset());

    it("upgrades programs saved before multiple conference memberships existed", () => {
        localStorage.setItem("spi-local-programs", JSON.stringify([{
            id: 1,
            name: "Legacy University",
            gender: "Men",
            division: "1",
            conference: "ACC",
            region: "East",
            logoUrl: null,
        }]));

        expect(readLocalPrograms()[0].conferences).toEqual(["ACC"]);
    });

    it("loads program metadata for a historical season", async () => {
        const programsQuery = query([{
            legacy_team_id: 49,
            gender: "Men",
            schools: {
                name: "Boston College",
                logo_url: "/logos/boston-college.png",
                conference: "ACC",
                region: "Northeast",
            },
            program_seasons: [{
                division: 1,
                conference: "ACC",
                region: "Northeast",
                seasons: { slug: "2024-25" },
                program_season_conferences: [{ conference: "ACC" }],
            }],
        }]);
        mocks.from.mockReturnValueOnce(programsQuery);

        await expect(loadPrograms("2024-25")).resolves.toEqual([{
            id: 49,
            name: "Boston College",
            gender: "Men",
            division: "1",
            conference: "ACC",
            conferences: ["ACC"],
            region: "Northeast",
            logoUrl: "/logos/boston-college.png",
        }]);

        expect(programsQuery.select).toHaveBeenCalled();
    });

    it("loads historical standings from the public database view", async () => {
        const standingsQuery = query([{
            team_id: 49,
            team_name: "Boston College",
            gender: "Men",
            weapon: "Foil",
            spi: 91.25,
        }]);
        mocks.from.mockReturnValueOnce(standingsQuery);

        await expect(loadStandings("2024-25")).resolves.toEqual([{
            teamId: 49,
            teamName: "Boston College",
            gender: "Men",
            weapon: "Foil",
            spi: 91.25,
        }]);

        expect(mocks.from).toHaveBeenCalledWith("public_spi_standings");
        expect(standingsQuery.eq).toHaveBeenCalledWith("season_slug", "2024-25");
    });

    it("loads historical matches with legacy team IDs", async () => {
        const matchesQuery = query([{
            id: 10,
            source_id: 4516,
            fenced_on: "2025-02-22",
            gender: "Men",
            left_sabre: 6,
            left_foil: 3,
            left_epee: 8,
            right_sabre: 3,
            right_foil: 6,
            right_epee: 1,
            host: "North Carolina",
            left_program: { legacy_team_id: 66 },
            right_program: { legacy_team_id: 22 },
        }]);
        mocks.from.mockReturnValueOnce(matchesQuery);

        await expect(loadMatches("2024-25")).resolves.toEqual([{
            id: 4516,
            date: "2025-02-22",
            gender: "Men",
            leftTeamId: 66,
            rightTeamId: 22,
            leftSabre: 6,
            leftFoil: 3,
            leftEpee: 8,
            rightSabre: 3,
            rightFoil: 6,
            rightEpee: 1,
            host: "North Carolina",
        }]);

        expect(matchesQuery.eq).toHaveBeenCalledWith("seasons.slug", "2024-25");
    });

    it("loads every match when a season exceeds the API row limit", async () => {
        const firstPage = query(Array.from({ length: 1000 }, (_, index) => databaseMatch(index + 1)));
        const secondPage = query([databaseMatch(1001)]);
        mocks.from.mockReturnValueOnce(firstPage).mockReturnValueOnce(secondPage);

        const matches = await loadMatches("2024-25");

        expect(matches).toHaveLength(1001);
        expect(firstPage.range).toHaveBeenCalledWith(0, 999);
        expect(secondPage.range).toHaveBeenCalledWith(1000, 1999);
    });
});

function databaseMatch(sourceId: number) {
    return {
        id: sourceId,
        source_id: sourceId,
        fenced_on: "2025-02-22",
        gender: "Men",
        left_sabre: 6,
        left_foil: 3,
        left_epee: 8,
        right_sabre: 3,
        right_foil: 6,
        right_epee: 1,
        host: "North Carolina",
        left_program: { legacy_team_id: 66 },
        right_program: { legacy_team_id: 22 },
    };
}
