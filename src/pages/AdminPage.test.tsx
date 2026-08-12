import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminPage from "./AdminPage";

vi.mock("../lib/adminRepository", () => ({
    createProgram: vi.fn(),
    loadCommitteeCounts: vi.fn().mockResolvedValue({ admins: 2, voters: 2 }),
}));

vi.mock("./PowerRatingsPage", () => ({
    default: () => <section aria-label="Power Rating Overrides" />,
}));

describe("AdminPage", () => {
    it("contains power-rating overrides in the admin dashboard", () => {
        render(<AdminPage
            user={{ id: "admin", name: "Admin User", role: "admin", canVote: true }}
            programs={[]}
            season="2025-26"
            onProgramAdded={() => undefined}
        />);

        expect(screen.getByRole("region", { name: "Power Rating Overrides" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /poll management/i })).toHaveAttribute("href", "#/admin/polls");
    });
});
