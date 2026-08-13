import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ loadParticipation: vi.fn(), loadPollPeriods: vi.fn() }));
vi.mock("../../lib/pollAdminRepository", () => mocks);
import PollParticipationPage from "./PollParticipationPage";

describe("PollParticipationPage", () => {
    it("shows one row per voter and ballot status", async () => {
        mocks.loadParticipation.mockResolvedValue([{ voterId: "u1", voterName: "Coach One", email: "coach@ucsd.edu", statuses: { men_team_overall: "submitted" } }]);
        render(<PollParticipationPage periodId="period-1" />);
        expect(await screen.findByText("Coach One")).toBeInTheDocument();
        expect(screen.getByText("Submitted")).toBeInTheDocument();
    });
});
