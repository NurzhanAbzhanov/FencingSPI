import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadPollResults: vi.fn(), loadIndividualBallots: vi.fn() }));
vi.mock("../../lib/pollRepository", () => mocks);
import PollResultsPage from "./PollResultsPage";

describe("PollResultsPage", () => {
    it("shows aggregate results and closed individual ballots", async () => {
        mocks.loadPollResults.mockResolvedValue([{ definitionId: "definition-1", category: { slug: "men_team_overall", label: "Men's Team Overall", gender: "Men", weapon: "Team", scope: "Overall", rankLimit: 15, hidden: false }, standings: [{ rank: 1, teamId: 1, teamName: "Alpha", points: 15, firstPlaceVotes: 1 }] }]);
        mocks.loadIndividualBallots.mockResolvedValue([{ ballotId: "b1", voterName: "Coach One", rankings: [{ rank: 1, teamId: 1, teamName: "Alpha" }] }]);
        render(<PollResultsPage periodId="period-1" />);
        expect(await screen.findByText("Alpha")).toBeInTheDocument();
        expect(await screen.findByText("Coach One")).toBeInTheDocument();
    });
});
