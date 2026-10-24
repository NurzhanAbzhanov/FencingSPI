import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ loadParticipation: vi.fn(), loadPollPeriods: vi.fn() }));
vi.mock("../../lib/pollAdminRepository", () => mocks);
import PollParticipationPage from "./PollParticipationPage";

describe("PollParticipationPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("finishes loading when the selected season has no polls", async () => {
        mocks.loadPollPeriods.mockResolvedValue([]);
        render(<PollParticipationPage />);
        expect(await screen.findByText("No poll periods found.")).toBeInTheDocument();
        expect(screen.queryByText("Loading participation data…")).not.toBeInTheDocument();
        expect(mocks.loadParticipation).not.toHaveBeenCalled();
    });

    it("shows period loading errors instead of inventing a poll ID", async () => {
        mocks.loadPollPeriods.mockRejectedValue(new Error("Could not load poll periods"));
        render(<PollParticipationPage />);
        expect(await screen.findByText("Could not load poll periods")).toBeInTheDocument();
        expect(mocks.loadParticipation).not.toHaveBeenCalled();
    });

    it("finds the current poll when the standings season has no polls", async () => {
        mocks.loadPollPeriods.mockResolvedValueOnce([]).mockResolvedValueOnce([
            { id: "current-period", label: "October", seasonSlug: "2026-27", status: "open" },
        ]);
        mocks.loadParticipation.mockResolvedValue([]);
        render(<PollParticipationPage season="2025-26" />);
        expect(await screen.findByText("No coaches found.")).toBeInTheDocument();
        await waitFor(() => expect(mocks.loadParticipation).toHaveBeenCalledWith("current-period"));
    });

    it("stops an indefinitely pending request with a retry message", async () => {
        vi.useFakeTimers();
        try {
            mocks.loadPollPeriods.mockReturnValue(new Promise(() => {}));
            render(<PollParticipationPage />);
            await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
            expect(screen.getByText("Loading poll periods timed out. Please retry.")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

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
