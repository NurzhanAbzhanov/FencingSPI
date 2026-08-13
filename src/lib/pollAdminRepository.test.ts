import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    from: vi.fn(),
    rpc: vi.fn(),
}));

vi.mock("./supabase", () => ({
    isSupabaseConfigured: true,
    supabase: { from: mocks.from, rpc: mocks.rpc },
}));

import { loadPollPeriods, saveCommitteeAccess, schedulePoll } from "./pollAdminRepository";

function query(data: unknown, error: unknown = null) {
    const result = Promise.resolve({ data, error });
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "in", "order", "limit", "maybeSingle", "single"]) {
        builder[method] = vi.fn(() => builder);
    }
    builder.then = result.then.bind(result);
    return builder;
}

describe("pollAdminRepository", () => {
    beforeEach(() => {
        mocks.from.mockReset();
        mocks.rpc.mockReset();
    });

    it("maps poll period state and its snapshot timestamp", async () => {
        mocks.from.mockReturnValueOnce(query([{
            id: "period-1",
            label: "October (Preseason)",
            status: "open",
            opens_at: "2026-10-01T12:00:00Z",
            closes_at: "2026-10-08T12:00:00Z",
            seasons: { slug: "2025-26" },
            poll_spi_snapshots: [{ captured_at: "2026-10-01T12:00:01Z" }],
        }]));

        await expect(loadPollPeriods("2025-26")).resolves.toEqual([expect.objectContaining({
            id: "period-1",
            label: "October (Preseason)",
            status: "open",
            snapshotCapturedAt: "2026-10-01T12:00:01Z",
        })]);
    });

    it("uses the period scheduling RPC contract", async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: null });
        await schedulePoll({ periodId: "period-1", opensAt: null, closesAt: "2026-10-08T12:00:00Z" });
        expect(mocks.rpc).toHaveBeenCalledWith("schedule_poll_period", {
            target_period: "period-1",
            requested_opens_at: null,
            requested_closes_at: "2026-10-08T12:00:00Z",
        });
    });

    it("normalizes committee email before saving access", async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: null });
        await saveCommitteeAccess({ email: " Coach@UCSD.edu ", displayName: "Coach", role: "coach", canVote: true, active: true });
        expect(mocks.rpc).toHaveBeenCalledWith("save_committee_access", expect.objectContaining({
            requested_email: "coach@ucsd.edu",
            requested_can_vote: true,
        }));
    });

    it("loads linked committee state through the admin-only RPC", async () => {
        mocks.rpc.mockResolvedValue({ data: [{ email: "coach@ucsd.edu", display_name: "Coach", role: "coach", can_vote: true, active: true, linked: true }], error: null });
        const { loadCommitteeAccess } = await import("./pollAdminRepository");
        await expect(loadCommitteeAccess()).resolves.toEqual([expect.objectContaining({ email: "coach@ucsd.edu", linked: true })]);
        expect(mocks.rpc).toHaveBeenCalledWith("list_committee_access");
    });
});
