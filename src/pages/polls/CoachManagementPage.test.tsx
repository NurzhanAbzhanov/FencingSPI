import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ loadCommitteeAccess: vi.fn(), saveCommitteeAccess: vi.fn() }));
vi.mock("../../lib/pollAdminRepository", () => mocks);
import CoachManagementPage from "./CoachManagementPage";

describe("CoachManagementPage", () => {
    it("shows voting access and active status", async () => {
        mocks.loadCommitteeAccess.mockResolvedValue([{ email: "coach@ucsd.edu", displayName: "Coach One", role: "coach", canVote: true, active: true, linked: true }]);
        render(<CoachManagementPage />);
        expect(await screen.findByText("coach@ucsd.edu")).toBeInTheDocument();
        expect(screen.getByText("Voter")).toBeInTheDocument();
    });
});
