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

    it("rejects missing column headers rather than treating a wrong file as an empty roster", () => {
        expect(() => normalizeFencerRatingUploadRows([
            { School: "Boston College", Weapon: "Foil" },
        ])).toThrow("Missing required column: Power Rating");
    });

    it('treats invalid ratings as unknown instead of using remaining rated fencers', () => {
        const issues: Array<{row:number;message:string}> = [];
        expect(normalizeFencerRatingUploadRows([
            {School:'Boston College',Weapon:'Foil',PR:'TBD'},
            {School:'Boston College',Weapon:'Foil',PR:0},
        ],issues)).toEqual([
            {teamName:'Boston College',weapon:'Foil',powerRating:null},
            {teamName:'Boston College',weapon:'Foil',powerRating:0},
        ]);
        expect(issues[0].row).toBe(2);
    });
    it('continues past missing cells while retaining incomplete-squad markers', () => {
        const issues: Array<{ row: number; message: string }> = [];
        const rows=normalizeFencerRatingUploadRows([
            { School:'Boston College',Weapon:'Foil',PR:80 },
            { School:'',Weapon:'Foil',PR:60 },
            { School:'Duke University',Weapon:'',PR:70 },
            { School:'Boston College',Weapon:'Epee',PR:'' },
        ],issues);
        expect(rows).toEqual([
            {teamName:'Boston College',weapon:'Foil',powerRating:80},
            {teamName:'Duke University',weapon:null,powerRating:70},
            {teamName:'Boston College',weapon:'Epee',powerRating:null},
        ]);
        expect(issues.map((issue)=>issue.row)).toEqual([3,4]);
    });

    it('preserves unknown ratings as null and real zero as zero', () => {
        expect(normalizeFencerRatingUploadRows([
            { School: 'Boston College', Weapon: 'Foil', PR: '' },
            { School: 'Boston College', Weapon: 'Epee', PR: 0 },
        ])).toEqual([
            { teamName: 'Boston College', weapon: 'Foil', powerRating: null },
            { teamName: 'Boston College', weapon: 'Epee', powerRating: 0 },
        ]);
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
