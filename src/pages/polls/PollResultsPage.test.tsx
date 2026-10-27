import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    loadPollResults: vi.fn().mockResolvedValue([
        {
            definitionId: "def-1",
            category: { slug: "men_team_overall", label: "Men's Team Overall", rankLimit: 15, hidden: false },
            standings: [{ rank: 1, teamId: "1", teamName: "Alpha", points: 15, firstPlaceVotes: 1 }],
        },
    ]),
    loadIndividualBallots: vi.fn().mockResolvedValue([
        { ballotId: "b1", voterName: "Coach One", rankings: [{ rank: 1, teamId: 1, teamName: "Alpha" }] },
    ]),
    from: vi.fn(),
    downloadCsv: vi.fn(),
}));

vi.mock("../../lib/pollRepository", () => mocks);
vi.mock("../../lib/pollCsv", async (importOriginal) => ({
    ...await importOriginal<typeof import('../../lib/pollCsv')>(),
    downloadCsv: mocks.downloadCsv,
}));
vi.mock("../../lib/supabase", () => ({ supabase: { from: mocks.from } }));
import PollResultsPage from "./PollResultsPage";

describe("PollResultsPage", () => {
    it('defaults to the published poll instead of a future draft when voting is closed', async () => {
        mocks.from.mockReturnValueOnce({ select: () => ({ order: async () => ({ data: [
            { id: 'future', label: 'January', status: 'draft', opens_at: null, closes_at: null },
            { id: 'published', label: 'October', status: 'published', opens_at: null, closes_at: null },
        ], error: null }) }) });
        render(<PollResultsPage periodId="current" />);
        await screen.findByText(/View individual ballots/i);
        expect(mocks.loadPollResults).toHaveBeenCalledWith('published');
    });
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.from.mockReturnValue({ select: () => ({ order: async () => ({ data: [
            { id: "period-1", label: "October", status: "open", opens_at: null, closes_at: null },
        ], error: null }) }) });
    });

    it("resolves current to the same poll ID for results and individual ballots", async () => {
        render(<PollResultsPage periodId="current" />);
        expect(await screen.findByText(/View individual ballots/i)).toBeInTheDocument();
        expect(mocks.loadPollResults).toHaveBeenCalledWith("period-1");
        expect(mocks.loadIndividualBallots).toHaveBeenCalledWith("def-1", "period-1");
        expect(mocks.loadIndividualBallots).not.toHaveBeenCalledWith("def-1", "current");
    });

    it("shows aggregate results and closed individual ballots", async () => {
        render(<PollResultsPage periodId="period-1" />);
        expect(await screen.findByText("Poll Results")).toBeInTheDocument();
        const alphaMatches = await screen.findAllByText("Alpha");
        expect(alphaMatches.length).toBeGreaterThan(0);
        // Ballots are hidden by default — expand them first
        const expandBtn = await screen.findByText(/View individual ballots/i);
        await userEvent.click(expandBtn);
        expect(await screen.findByText("Coach One")).toBeInTheDocument();
    });

    it("exports labeled tables for only the selected category tab", async () => {
        mocks.loadPollResults.mockResolvedValueOnce([
            { definitionId: 'team', category: { slug: 'men_team_overall', label: "Men's Team Overall", rankLimit: 15 }, standings: [] },
            { definitionId: 'epee', category: { slug: 'men_squad_epee_overall', label: "Men's Epee Overall", rankLimit: 15 }, standings: [{ rank: 1, teamId: 1, teamName: 'Alpha', points: 15, firstPlaceVotes: 1 }] },
        ]);
        render(<PollResultsPage periodId="current" />);
        await screen.findByText("Men's Epee Overall");
        await userEvent.click(screen.getByRole('button', { name: "Men's Squads" }));
        await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
        expect(mocks.downloadCsv).toHaveBeenCalledWith('october-mens_squads-results.csv', expect.any(String));
        const csv = mocks.downloadCsv.mock.calls[0][1] as string;
        expect(csv).toContain('"Poll","October"');
        expect(csv).toContain('"Selection","Men\'s Squads"');
        expect(csv).toContain('"Category","Men\'s Epee Overall"');
        expect(csv).not.toContain("Men's Team Overall");
    });
});
