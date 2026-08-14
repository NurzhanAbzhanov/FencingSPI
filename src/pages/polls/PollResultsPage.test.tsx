import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
}));

vi.mock("../../lib/pollRepository", () => mocks);
import PollResultsPage from "./PollResultsPage";

describe("PollResultsPage", () => {
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
});
