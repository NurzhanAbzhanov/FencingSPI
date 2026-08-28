import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    from: vi.fn(),
    rpc: vi.fn(),
}));

vi.mock("./supabase", () => ({
    supabase: { from: mocks.from, rpc: mocks.rpc },
}));

import {
    loadPowerRatingRecords,
    loadPowerRatingSeasons,
    normalizeFencerRatingUploadRows,
    recalculatePowerRatings,
} from "./powerRatingOverrides";

function query(data: unknown, error: unknown = null) {
    const result = Promise.resolve({ data, error });
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order"]) {
        builder[method] = vi.fn(() => builder);
    }
    builder.then = result.then.bind(result);
    return builder;
}

describe("powerRatingOverrides", () => {
    beforeEach(() => {
        mocks.from.mockReset();
        mocks.rpc.mockReset();
    });

    it("loads calculated power ratings directly from spi_results", async () => {
        const resultQuery = query([{
            power_rating: 90,
            weapon: "Team",
            seasons: { slug: "2025-26" },
            programs: {
                legacy_team_id: 49,
                gender: "Men",
                schools: { name: "Boston College" },
            },
        }]);
        mocks.from.mockReturnValueOnce(resultQuery);

        const records = await loadPowerRatingRecords("2025-26");

        expect(mocks.from).toHaveBeenCalledWith("spi_results");
        expect(resultQuery.eq).toHaveBeenCalledWith("seasons.slug", "2025-26");
        expect(records).toEqual([{
            teamId: 49,
            teamName: "Boston College",
            gender: "Men",
            weapon: "Team",
            calculatedPowerRating: 90,
        }]);
    });

    it("loads available seasons newest first", async () => {
        const seasonsQuery = query([
            { slug: "2026-27", starts_on: "2026-08-01" },
            { slug: "2025-26", starts_on: "2025-08-01" },
        ]);
        mocks.from.mockReturnValueOnce(seasonsQuery);

        await expect(loadPowerRatingSeasons()).resolves.toEqual(["2026-27", "2025-26"]);

        expect(mocks.from).toHaveBeenCalledWith("seasons");
        expect(seasonsQuery.order).toHaveBeenCalledWith("starts_on", { ascending: false });
    });

    it("normalizes common fencer-rating spreadsheet headers and Sabre spelling", () => {
        expect(normalizeFencerRatingUploadRows([
            { School: "Boston College", Weapon: "Saber", "Power Rating": "80" },
            { School: "Boston College", Weapon: "Foil", "Power Rating": 70 },
        ])).toEqual([
            { teamName: "Boston College", weapon: "Sabre", powerRating: 80 },
            { teamName: "Boston College", weapon: "Foil", powerRating: 70 },
        ]);
    });

    it("rejects upload rows with missing required values", () => {
        expect(() => normalizeFencerRatingUploadRows([
            { School: "Boston College", Weapon: "Foil" },
        ])).toThrow("Row 2 is missing a power rating");
    });

    it("invokes the atomic recalculation RPC", async () => {
        mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
        const rows = [{ teamName: "Boston College", weapon: "Epee" as const, powerRating: 90 }];

        await recalculatePowerRatings("2026-27", "Men", rows, "men.xlsx");

        expect(mocks.rpc).toHaveBeenCalledWith("replace_fencer_ratings_and_recalculate", {
            p_season_slug: "2026-27",
            p_gender: "Men",
            p_rows: [{ team_name: "Boston College", weapon: "Epee", power_rating: 90 }],
            p_source_file: "men.xlsx",
        });
    });
});
