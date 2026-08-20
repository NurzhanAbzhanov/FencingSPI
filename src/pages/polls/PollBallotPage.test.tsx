import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadPollBallot: vi.fn(), savePollBallot: vi.fn() }));
vi.mock("../../lib/pollRepository", () => ({ loadPollBallot: mocks.loadPollBallot, savePollBallot: mocks.savePollBallot }));

import PollBallotPage from "./PollBallotPage";

const user = { id: "user-1", name: "Coach One", role: "coach" as const, canVote: true };
const period = { id: "period-1", label: "October (Preseason)", seasonSlug: "2025-26", status: "open" as const, opensAt: null, closesAt: null, effectivelyOpen: true };

describe("PollBallotPage", () => {
    it("blocks Team Division III until the overall ballot is submitted", async () => {
        mocks.loadPollBallot.mockResolvedValue({ definitionId: "d3", period, category: { slug: "men_team_diii", label: "Men's Team Division III", gender: "Men", weapon: "Team", scope: "DIII", rankLimit: 8, hidden: false }, candidates: [], rankings: [], submitted: false, prerequisite: "overall-required", lockedTeamIds: [] });
        render(<PollBallotPage slug="men_team_diii" user={user} />);
        expect(await screen.findByText("Complete overall ballot first")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /go to men's team overall/i })).toHaveAttribute("href", "#/polls/vote/men_team_overall");
    });

    it("quick-ranks a candidate and submits after review", async () => {
        const category = { slug: "men_squad_epee_overall", label: "Men's Epee Overall", gender: "Men", weapon: "Epee", scope: "Overall", rankLimit: 2, hidden: false } as const;
        const candidates = [
            { programId: "p1", teamId: 1, teamName: "Alpha", logoUrl: null, division: 1, conference: "ACC", region: "East", currentSpi: 100, previousSpi: 95, spiRank: 1, powerRating: 90 },
            { programId: "p2", teamId: 2, teamName: "Beta", logoUrl: null, division: 3, conference: "CCFC", region: "West", currentSpi: 90, previousSpi: null, spiRank: 2, powerRating: 80 },
        ];
        mocks.loadPollBallot.mockResolvedValue({ definitionId: "definition-1", period, category, candidates, rankings: [], submitted: false, prerequisite: "ready", lockedTeamIds: [] });
        mocks.savePollBallot.mockResolvedValue("ballot-1");
        const event = userEvent.setup();
        render(<PollBallotPage slug="men_squad_epee_overall" user={user} />);

        expect(await screen.findByRole("columnheader", { name: "SPI Rank" })).toBeInTheDocument();
        expect(screen.getByRole("cell", { name: "#1" })).toHaveClass("spi-rank-cell");
        expect(screen.getByRole("cell", { name: "100.0000" })).toHaveClass("current-spi-cell");
        expect(screen.getByRole("cell", { name: "95.0000" })).toHaveClass("previous-spi-cell");
        expect(screen.getByRole("cell", { name: "90" })).toHaveClass("power-rating-cell");
        expect(screen.queryByRole("cell", { name: "90.0" })).not.toBeInTheDocument();

        await event.click(await screen.findByRole("button", { name: "Rank Alpha at position 1" }));
        await event.click(screen.getByRole("button", { name: "Rank Beta at position 2" }));
        await event.click(screen.getByRole("button", { name: "Review ballot" }));
        expect(screen.getByRole("dialog")).toHaveTextContent("Alpha");
        await event.click(screen.getByRole("button", { name: "Confirm and submit" }));
        expect(mocks.savePollBallot).toHaveBeenCalledWith({ definitionId: "definition-1", teamIds: [1, 2], submit: true });
    });
});
