import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    from: vi.fn(),
    rpc: vi.fn(),
    getUser: vi.fn(),
}));

vi.mock("./supabase", () => ({
    isSupabaseConfigured: true,
    supabase: { from: mocks.from, rpc: mocks.rpc, auth: { getUser: mocks.getUser } },
}));

import { loadPollBallot, loadPollDashboard, loadPollResults, savePollBallot } from "./pollRepository";

function query(data: unknown, error: unknown = null) {
    const result = Promise.resolve({ data, error });
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "in", "order", "limit", "maybeSingle", "single", "upsert"]) {
        builder[method] = vi.fn(() => builder);
    }
    builder.then = result.then.bind(result);
    return builder;
}

describe("pollRepository", () => {
    it('loads frozen published vote results without consulting live ballots', async () => {
        mocks.from.mockReturnValue(query([{ team_id: 49, gender: 'Men', weapon: 'Team', scope: 'Overall', rank: 1, points: 100, first_place_votes: 4,
            programs: { schools: { name: 'Boston College' } } }]));
        const { loadPollResults } = await import('./pollRepository');
        const result = await loadPollResults('004955ba-5872-43b5-a0a2-2c185ad49026');
        expect(result[0]).toMatchObject({ definitionId: 'men_team_overall', standings: [{ teamId: 49, points: 100, firstPlaceVotes: 4 }] });
        expect(mocks.from).not.toHaveBeenCalledWith('votes');
    });
    beforeEach(() => {
        mocks.from.mockReset();
        mocks.rpc.mockReset();
        mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        localStorage.clear();
    });

    it.each([null, { id: "vote-1", category: "men_team_overall", status: "submitted", rankings: [49] }])(
        "uses database votes when the deployed schema has no ballots table: %j", async (vote) => {
        localStorage.setItem("user_user-1_submitted_ballots", '{"men_team_overall":true}');
        const definition = { id: "men_team_overall", period_id: "period-1", slug: "men_team_overall",
            poll_periods: { id: "period-1", label: "October", status: "open", opens_at: null, closes_at: null, seasons: { slug: "2026-27" } } };
        mocks.from.mockImplementation((table: string) => {
            if (table === "poll_periods") return query([definition.poll_periods]);
            if (table === "ballot_definitions") return query([definition]);
            if (table === "ballots") return query(null, { code: "PGRST205", message: "Could not find public.ballots" });
            if (table === "votes") {
                const result = query(vote ? [vote] : []);
                result.maybeSingle = vi.fn(() => query(vote));
                return result;
            }
            return query([]);
        });
        expect((await loadPollDashboard("user-1")).categories[0].ballotStatus).toBe(vote ? "submitted" : "not_started");
        expect(await loadPollBallot("men_team_overall", "user-1")).toMatchObject({ submitted: Boolean(vote), rankings: vote?.rankings ?? [] });
    });

    it("uses the secure voting RPC and propagates write failures", async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: new Error("Write denied") });
        mocks.from.mockImplementation((table: string) => {
            if (table === "ballot_definitions") return query([{ id: "men_team_overall", period_id: "period-1", slug: "men_team_overall",
                poll_periods: { id: "period-1", label: "October", status: "open", opens_at: null, closes_at: null, seasons: { slug: "2026-27" } } }]);
            if (table === "programs") return query([{ id: "p49", legacy_team_id: 49, schools: { name: "Boston College", logo_url: null } }]);
            if (table === "ballots") return query(null, { code: "PGRST205", message: "Could not find public.ballots" });
            if (table === "votes") return query(null);
            return query([]);
        });
        await expect(savePollBallot({ definitionId: "men_team_overall", teamIds: [49], submit: false })).rejects.toThrow("Write denied");
        expect(mocks.rpc).toHaveBeenCalledWith("save_committee_vote", {
            target_period: "period-1", target_category: "men_team_overall", ranked_teams: [49], submit_now: false,
        });
        expect(localStorage.length).toBe(0);
    });

    it("ignores stale submitted caches and legacy votes after a ballot is deleted", async () => {
        localStorage.setItem("user_user-1_submitted_ballots", JSON.stringify({ "definition-1": true, men_team_overall: true }));
        localStorage.setItem("user_user-1_poll_ballot_definition-1", "[49]");
        const definition = { id: "definition-1", period_id: "period-1", slug: "men_team_overall",
            poll_periods: { id: "period-1", label: "October", status: "open", opens_at: null, closes_at: null, seasons: { slug: "2026-27" } } };
        mocks.from.mockImplementation((table: string) => {
            if (table === "poll_periods") return query([definition.poll_periods]);
            if (table === "ballot_definitions") return query([definition]);
            if (table === "votes") return query([{ status: "submitted", category: "men_team_overall", rankings: [49] }]);
            return query([]);
        });
        expect((await loadPollDashboard("user-1")).categories[0].ballotStatus).toBe("not_started");
        expect(await loadPollBallot("men_team_overall", "user-1")).toMatchObject({ submitted: false, rankings: [] });
        expect(mocks.from).not.toHaveBeenCalledWith("votes");
    });

    it("propagates failed submissions instead of recording local success", async () => {
        mocks.from.mockReturnValue(query([{ id: "p49", legacy_team_id: 49 }]));
        mocks.rpc.mockResolvedValue({ data: null, error: new Error("Poll closed") });
        await expect(savePollBallot({ definitionId: "a0000000-0000-4000-8000-000000000001", teamIds: [49], submit: true })).rejects.toThrow("Poll closed");
        expect(localStorage.length).toBe(0);
        expect(mocks.from).not.toHaveBeenCalledWith("votes");
    });

    it("blocks DIII when an overall submission exists only in browser or legacy storage", async () => {
        localStorage.setItem("user_user-1_poll_ballot_men_team_overall", "[49]");
        let definitionsRead = 0;
        mocks.from.mockImplementation((table: string) => {
            if (table === "ballot_definitions") {
                definitionsRead++;
                return query(definitionsRead === 1 ? [{ id: "d3", period_id: "period-1", slug: "men_team_diii",
                    poll_periods: { id: "period-1", label: "October", status: "open", opens_at: null, closes_at: null, seasons: { slug: "2026-27" } } }] : { id: "overall" });
            }
            return query([]);
        });
        expect(await loadPollBallot("men_team_diii", "user-1")).toMatchObject({ prerequisite: "overall-required", lockedTeamIds: [] });
        expect(mocks.from).not.toHaveBeenCalledWith("votes");
    });

    it("maps live and prior-season SPI into ballot candidates ordered by live SPI", async () => {
        const seasonsQuery = query([
            { id: "season-current", slug: "2025-26", starts_on: "2025-08-01", ends_on: "2026-07-31" },
            { id: "season-previous", slug: "2024-25", starts_on: "2024-08-01", ends_on: "2025-07-31" },
        ]);
        const resultsQuery = query([
            { season_id: "season-current", program_id: "program-26", spi: 110, power_rating: 80 },
            { season_id: "season-current", program_id: "program-50", spi: 120, power_rating: 90 },
            { season_id: "season-previous", program_id: "program-50", spi: 98 },
        ]);
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
            .mockReturnValueOnce(query([
                {
                    program_id: "program-26",
                    spi: 112.5,
                    spi_rank: 1,
                    power_rating: 70,
                    division: 1,
                    conference: "ACC",
                    region: "Northeast",
                    programs: { legacy_team_id: 26, schools: { name: "Penn State", logo_url: null } },
                },
                {
                    program_id: "program-50",
                    spi: 105,
                    spi_rank: 2,
                    power_rating: 80,
                    division: 3,
                    conference: "CCFC",
                    region: "Midwest",
                    programs: { legacy_team_id: 50, schools: { name: "Brandeis", logo_url: null } },
                },
            ]))
            .mockReturnValueOnce(seasonsQuery)
            .mockReturnValueOnce(resultsQuery)
            .mockReturnValueOnce(query([{ program_id: "program-50", adjusted_power_rating: 100 }]));

        const ballot = await loadPollBallot("men_team_overall", "user-1");

        expect(mocks.from).toHaveBeenCalledWith("poll_spi_snapshots");
        expect(ballot.candidates).toMatchObject([
            { programId: "program-50", teamId: 50, currentSpi: 120, previousSpi: 98, spiRank: 1, powerRating: 100 },
            { programId: "program-26", teamId: 26, currentSpi: 110, previousSpi: null, spiRank: 2, powerRating: 80 },
        ]);
        expect(seasonsQuery.order).toHaveBeenCalledWith("ends_on", { ascending: false });
        expect(resultsQuery.in).toHaveBeenCalledWith("season_id", ["season-current", "season-previous"]);
        expect(resultsQuery.in).toHaveBeenCalledWith("program_id", ["program-26", "program-50"]);
        expect(resultsQuery.eq).toHaveBeenCalledWith("weapon", "Team");
        expect(ballot.rankings).toEqual([]);
        expect(ballot.prerequisite).toBe("ready");
    });

    it("leaves current SPI and rank unavailable instead of falling back to a snapshot", async () => {
        mocks.from
            .mockReturnValueOnce(query([{
                id: "definition-1",
                period_id: "period-1",
                slug: "men_team_overall",
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
            .mockReturnValueOnce(query([
                { id: "season-current", slug: "2025-26", starts_on: "2025-08-01", ends_on: "2026-07-31" },
            ]))
            .mockReturnValueOnce(query([]))
            .mockReturnValueOnce(query([]));

        const ballot = await loadPollBallot("men_team_overall", "user-1");

        expect(ballot.candidates[0]).toMatchObject({
            currentSpi: null,
            previousSpi: null,
            spiRank: null,
        });
    });

    it.each([
        { label: "October (Preseason)", current: null, previousOverride: null, expected: 80 },
        { label: "October (Preseason)", current: null, previousOverride: 90, expected: 90 },
        { label: "October (Preseason)", current: 100, previousOverride: 90, expected: 100 },
        { label: "October (Preseason)", current: 0, previousOverride: 90, expected: 0 },
        { label: "November", current: null, previousOverride: null, expected: null },
    ])("uses previous PR only as a preseason fallback: $label / $current / $previousOverride", async ({ label, current, previousOverride, expected }) => {
        mocks.from
            .mockReturnValueOnce(query([{ id: "definition-1", period_id: "period-1", slug: "men_team_overall",
                poll_periods: { label, status: "open", opens_at: null, closes_at: null, seasons: { slug: "2026-27" } } }]))
            .mockReturnValueOnce(query([{ program_id: "p1", spi: 0, power_rating: null,
                programs: { legacy_team_id: 49, schools: { name: "Boston College", logo_url: null } } }]))
            .mockReturnValueOnce(query([
                { id: "current", slug: "2026-27", ends_on: "2027-07-31" },
                { id: "previous", slug: "2025-26", ends_on: "2026-07-31" },
            ]))
            .mockReturnValueOnce(query([{ season_id: "previous", program_id: "p1", spi: 95, power_rating: 80 }]))
            .mockReturnValueOnce(query(current == null ? [] : [{ program_id: "p1", adjusted_power_rating: current }]))
            .mockReturnValueOnce(query(previousOverride == null ? [] : [{ program_id: "p1", adjusted_power_rating: previousOverride }]));
        const ballot = await loadPollBallot("men_team_overall", "user-1");
        expect(ballot.candidates[0]).toMatchObject({ powerRating: expected, currentSpi: null, previousSpi: 95 });
    });

    it("selects the effective open period when a category exists in multiple months", async () => {
        mocks.from
            .mockReturnValueOnce(query([{
                id: "closed-definition",
                period_id: "closed-period",
                slug: "men_team_overall",
                poll_periods: { id: "closed-period", label: "November", status: "closed", opens_at: "2026-11-01T00:00:00Z", closes_at: "2026-11-08T00:00:00Z", seasons: { slug: "2025-26" } },
            }, {
                id: "open-definition",
                period_id: "open-period",
                slug: "men_team_overall",
                poll_periods: { id: "open-period", label: "December", status: "open", opens_at: null, closes_at: null, seasons: { slug: "2025-26" } },
            }]))
            .mockReturnValueOnce(query([]))
            .mockReturnValueOnce(query([]));

        const ballot = await loadPollBallot("men_team_overall", "user-1");
        expect(ballot.definitionId).toBe("open-definition");
        expect(ballot.period.id).toBe("open-period");
    });

    it("converts legacy team IDs to program UUIDs before saving", async () => {
        mocks.from.mockReturnValueOnce(query([
            { id: "program-49", legacy_team_id: 49 },
            { id: "program-50", legacy_team_id: 50 },
            { id: "program-51", legacy_team_id: 51 },
        ]));
        mocks.rpc.mockResolvedValue({ data: "ballot-1", error: null });

        await savePollBallot({
            definitionId: "a0000000-0000-4000-8000-000000000001",
            teamIds: [49, 50, 51],
            submit: true,
        });

        expect(mocks.rpc).toHaveBeenCalledWith("save_poll_ballot", {
            target_definition: "a0000000-0000-4000-8000-000000000001",
            ranked_programs: ["program-49", "program-50", "program-51"],
            submit_now: true,
        });
    });

    it("calculates tied aggregate results for authenticated users after close", async () => {
        mocks.from
            .mockReturnValueOnce(query([]))  // published_poll_results (loadResults short-circuit)
            .mockReturnValueOnce(query([{ id: "period-1", status: "open", opens_at: new Date().toISOString() }]))  // poll_periods (period resolution)
            .mockReturnValueOnce(query([{ id: "definition-1", slug: "men_team_overall", rank_limit: 3 }]))
            .mockReturnValueOnce(query([
                {
                    definition_id: "definition-1",
                    ballot_rankings: [
                        { rank: 1, programs: { legacy_team_id: 1, schools: { name: "Alpha" } } },
                        { rank: 2, programs: { legacy_team_id: 2, schools: { name: "Beta" } } },
                    ],
                },
                {
                    definition_id: "definition-1",
                    ballot_rankings: [
                        { rank: 1, programs: { legacy_team_id: 2, schools: { name: "Beta" } } },
                        { rank: 2, programs: { legacy_team_id: 1, schools: { name: "Alpha" } } },
                    ],
                },
            ]));

        const results = await loadPollResults("period-1");

        expect(results[0].standings).toMatchObject([
            { rank: 1, teamId: 1, points: 5 },
            { rank: 1, teamId: 2, points: 5 },
        ]);
    });
});
