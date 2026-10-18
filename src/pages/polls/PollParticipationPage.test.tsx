import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ loadParticipation: vi.fn(), loadPollPeriods: vi.fn() }));
vi.mock("../../lib/pollAdminRepository", () => mocks);
import PollParticipationPage from "./PollParticipationPage";

describe("PollParticipationPage", () => {
    it("shows one row per voter and ballot status", async () => {
        mocks.loadPollPeriods.mockResolvedValue([{ id: "period-1", label: "August Poll", season: "2025-26", status: "open", opensAt: null, closesAt: null, publishedAt: null }]);
        mocks.loadParticipation.mockResolvedValue([{ voterId: "u1", voterName: "Coach One", email: "coach@ucsd.edu", statuses: { men_team_overall: "submitted" } }]);
        render(<PollParticipationPage periodId="period-1" />);
        expect(await screen.findByText("Coach One")).toBeInTheDocument();
        expect(screen.getByText("In progress")).toBeInTheDocument();
    });

    it("defaults to active open period when periodId is current", async () => {
        mocks.loadPollPeriods.mockResolvedValue([
            { id: "period-closed", label: "September Poll", status: "closed" },
            { id: "period-open", label: "October Poll", status: "open" },
        ]);
        mocks.loadParticipation.mockResolvedValue([{ voterId: "u2", voterName: "Coach Two", email: "c2@ucsd.edu", statuses: {} }]);
        render(<PollParticipationPage periodId="current" />);
        expect(await screen.findByText("Coach Two")).toBeInTheDocument();
        expect(mocks.loadParticipation).toHaveBeenCalledWith("period-open");
    });

    it("displays empty state when no poll periods are available", async () => {
        mocks.loadPollPeriods.mockResolvedValue([]);
        render(<PollParticipationPage periodId="current" />);
        expect(await screen.findByText("No poll periods found.")).toBeInTheDocument();
    });
});
