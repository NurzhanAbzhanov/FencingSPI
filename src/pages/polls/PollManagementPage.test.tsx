import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ loadPollPeriods: vi.fn(), openPoll: vi.fn(), closePoll: vi.fn(), publishPoll: vi.fn(), schedulePoll: vi.fn() }));
vi.mock("../../lib/pollAdminRepository", () => mocks);
import PollManagementPage from "./PollManagementPage";

describe("PollManagementPage", () => {
    it("shows state-specific controls", async () => {
        mocks.loadPollPeriods.mockResolvedValue([{ id: "p1", label: "October", seasonSlug: "2025-26", status: "draft", opensAt: null, closesAt: null, effectivelyOpen: false, snapshotCapturedAt: null }]);
        render(<PollManagementPage season="2025-26" />);
        expect(await screen.findByRole("button", { name: "Create Poll" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Manage Polls" })).toBeInTheDocument();
    });
});
