import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { POLL_CATEGORY_SPECS } from "../../lib/pollDomain";

const mocks = vi.hoisted(() => ({ loadPollDashboard: vi.fn() }));
vi.mock("../../lib/pollRepository", () => ({ loadPollDashboard: mocks.loadPollDashboard }));

import PollDashboardPage from "./PollDashboardPage";

describe("PollDashboardPage", () => {
    it("shows the ten supported ballots and respects non-voting access", async () => {
        mocks.loadPollDashboard.mockResolvedValue({
            period: { id: "period-1", label: "October (Preseason)", seasonSlug: "2025-26", status: "open", opensAt: null, closesAt: "2026-10-08T12:00:00Z", effectivelyOpen: true },
            categories: POLL_CATEGORY_SPECS.filter((item) => !item.hidden).map((item) => ({ ...item, definitionId: item.slug, ballotStatus: "not_started" })),
        });
        render(<PollDashboardPage user={{ id: "user-1", name: "Observer", role: "admin", canVote: false }} />);

        expect(await screen.findByRole("heading", { name: "October (Preseason)" })).toBeInTheDocument();
        expect(screen.getAllByTestId("poll-category")).toHaveLength(10);
        expect(screen.queryByText("Women's Sabre Division III")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /vote/i })).not.toBeInTheDocument();
    });
});
