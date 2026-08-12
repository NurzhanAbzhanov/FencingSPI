import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadPublicPollResults: vi.fn() }));
vi.mock("../../lib/pollRepository", () => mocks);
import PublicPollResultsPage from "./PublicPollResultsPage";

describe("PublicPollResultsPage", () => {
    it("shows anonymous published standings without voter names", async () => {
        mocks.loadPublicPollResults.mockResolvedValue([{ definitionId: "definition-1", category: { slug: "men_team_overall", label: "Men's Team Overall", gender: "Men", weapon: "Team", scope: "Overall", rankLimit: 15, hidden: false }, standings: [{ rank: 1, teamId: 1, teamName: "Alpha", points: 15, firstPlaceVotes: 1 }] }]);
        render(<PublicPollResultsPage periodId="period-1" />);
        expect(await screen.findByText("Alpha")).toBeInTheDocument();
        expect(screen.queryByText("Coach One")).not.toBeInTheDocument();
    });
});
