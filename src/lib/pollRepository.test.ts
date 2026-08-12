import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    from: vi.fn(),
    rpc: vi.fn(),
}));

vi.mock("./supabase", () => ({
    isSupabaseConfigured: true,
    supabase: { from: mocks.from, rpc: mocks.rpc },
}));

import { loadPollBallot, savePollBallot } from "./pollRepository";

function query(data: unknown, error: unknown = null) {
    const result = Promise.resolve({ data, error });
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "in", "order", "limit", "maybeSingle", "single"]) {
        builder[method] = vi.fn(() => builder);
    }
    builder.then = result.then.bind(result);
    return builder;
}

describe("pollRepository", () => {
    beforeEach(() => {
        mocks.from.mockReset();
        mocks.rpc.mockReset();
    });

    it("maps a calculated SPI snapshot into ballot candidates", async () => {
        mocks.from
            .mockReturnValueOnce(query([{
                id: "definition-1",
                period_id: "period-1",
                slug: "men_team_overall",
                gender: "Men",
                weapon: "Team",
                scope: "Overall",
                rank_limit: 15,
                hidden: false,
                poll_periods: { label: "October (Preseason)", status: "open", opens_at: null, closes_at: null, seasons: { slug: "2025-26" } },
            }]))
            .mockReturnValueOnce(query([{
                program_id: "program-49",
                spi: 112.5,
                spi_rank: 1,
                power_rating: 90,
                division: 1,
                conference: "ACC",
                region: "Northeast",
                programs: { legacy_team_id: 49, schools: { name: "Boston College", logo_url: null } },
            }]))
            .mockReturnValueOnce(query([]));

        const ballot = await loadPollBallot("men_team_overall", "user-1");

        expect(mocks.from).toHaveBeenCalledWith("poll_spi_snapshots");
        expect(ballot.candidates[0]).toMatchObject({
            programId: "program-49",
            teamId: 49,
            teamName: "Boston College",
            spi: 112.5,
            spiRank: 1,
            powerRating: 90,
        });
        expect(ballot.rankings).toEqual([]);
        expect(ballot.prerequisite).toBe("ready");
    });

    it("converts legacy team IDs to program UUIDs before saving", async () => {
        mocks.from.mockReturnValueOnce(query([
            { id: "program-49", legacy_team_id: 49 },
            { id: "program-50", legacy_team_id: 50 },
            { id: "program-51", legacy_team_id: 51 },
        ]));
        mocks.rpc.mockResolvedValue({ data: "ballot-1", error: null });

        await savePollBallot({
            definitionId: "definition-1",
            teamIds: [49, 50, 51],
            submit: true,
        });

        expect(mocks.rpc).toHaveBeenCalledWith("save_poll_ballot", {
            target_definition: "definition-1",
            ranked_programs: ["program-49", "program-50", "program-51"],
            submit_now: true,
        });
    });
});
