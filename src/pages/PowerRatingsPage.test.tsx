import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    loadRecords: vi.fn(),
    loadOverrides: vi.fn(),
    loadSeasons: vi.fn(),
    parseFile: vi.fn(),
    recalculate: vi.fn(),
}));

vi.mock("../lib/powerRatingOverrides", () => ({
    createOverrideKey: ({ teamId, gender, weapon }: { teamId: number; gender: string; weapon: string }) => `${teamId}:${gender}:${weapon}`,
    deletePowerRatingOverride: vi.fn(),
    loadPowerRatingOverrides: mocks.loadOverrides,
    loadPowerRatingRecords: mocks.loadRecords,
    loadPowerRatingSeasons: mocks.loadSeasons,
    parseFencerRatingFile: mocks.parseFile,
    recalculatePowerRatings: mocks.recalculate,
    savePowerRatingOverride: vi.fn(),
}));

import PowerRatingsPage from "./PowerRatingsPage";

describe("PowerRatingsPage", () => {
    beforeEach(() => {
        mocks.loadRecords.mockReset().mockResolvedValue([]);
        mocks.loadOverrides.mockReset().mockResolvedValue([]);
        mocks.loadSeasons.mockReset().mockResolvedValue(["2026-27", "2025-26"]);
        mocks.parseFile.mockReset().mockResolvedValue([
            { teamName: "Boston College", weapon: "Epee", powerRating: 90 },
        ]);
        mocks.recalculate.mockReset().mockResolvedValue(undefined);
        vi.spyOn(window, "confirm").mockReturnValue(true);
    });

    it("recalculates a gender from an uploaded fencer-rating file and refreshes records", async () => {
        const user = userEvent.setup();
        render(<PowerRatingsPage
            embedded
            programs={[{
                id: 49,
                name: "Boston College",
                gender: "Men",
                division: "1",
                conference: "ACC",
                conferences: ["ACC"],
                region: "Northeast",
                logoUrl: null,
            }]}
            season="2025-26"
            user={{ id: "admin", name: "Admin", role: "admin", canVote: true }}
        />);

        expect(screen.queryByRole("textbox", { name: "Recalculation season" })).not.toBeInTheDocument();
        await user.click(await screen.findByRole("button", { name: "2026-27" }));
        const file = new File(["ratings"], "men-ratings.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        await user.upload(await screen.findByLabelText("Men fencer ratings"), file);
        await user.click(screen.getByRole("button", { name: "Recalculate power ratings" }));

        await waitFor(() => expect(mocks.recalculate).toHaveBeenCalledWith(
            "2026-27",
            "Men",
            [{ teamName: "Boston College", weapon: "Epee", powerRating: 90 }],
            "men-ratings.xlsx"
        ));
        expect(mocks.loadRecords).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("status")).toHaveTextContent("Power ratings recalculated");
        expect(screen.getByRole("region", { name: "Power Ratings" })).toBeInTheDocument();
    });
});
