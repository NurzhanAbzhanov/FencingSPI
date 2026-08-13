import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PollSpiReference from "./PollSpiReference";
import type { PollCandidate } from "../../types/polls";

const candidates: PollCandidate[] = [
    {
        programId: "alpha-program",
        teamId: 1,
        teamName: "Alpha",
        logoUrl: null,
        division: 1,
        conference: "Conference Alpha",
        region: "Region Alpha",
        spi: 12.3456,
        spiRank: 1,
        powerRating: 10,
    },
    {
        programId: "beta-program",
        teamId: 2,
        teamName: "Beta",
        logoUrl: null,
        division: 3,
        conference: "Conference Beta",
        region: "Region Beta",
        spi: 9.8765,
        spiRank: 2,
        powerRating: null,
    },
];

describe("PollSpiReference", () => {
    it("renders compact placement actions and ranks an available school", async () => {
        const user = userEvent.setup();
        const onRank = vi.fn();

        render(<PollSpiReference candidates={candidates} seasonSlug="2025-26" rankedTeamIds={[1, 0, 0]} onRank={onRank} />);

        expect(screen.getByText("#1")).toBeInTheDocument();
        expect(screen.getByText("Voted")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Rank Beta at position 2" })).toHaveTextContent("+ Rank 2");
        expect(screen.queryByText("Conference")).not.toBeInTheDocument();
        expect(screen.queryByText("Region")).not.toBeInTheDocument();
        expect(screen.queryByText("PR")).not.toBeInTheDocument();
        expect(screen.queryByText("Results")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Rank Beta at position 2" }));

        expect(onRank).toHaveBeenCalledWith(2);
    });
});
