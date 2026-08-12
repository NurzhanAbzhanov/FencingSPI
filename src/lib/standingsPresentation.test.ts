import { describe, expect, it } from "vitest";
import { createStandingsCsv, formatDivision } from "./standingsPresentation";

describe("formatDivision", () => {
    it.each([
        ["1", "I"],
        ["2", "II"],
        ["3", "III"],
        ["Unassigned", "Unassigned"],
    ])("formats %s as %s", (value, expected) => {
        expect(formatDivision(value)).toBe(expected);
    });
});

describe("createStandingsCsv", () => {
    it("places the download timestamp and active filters above the standings table", () => {
        const csv = createStandingsCsv({
            downloadedAt: new Date("2026-08-12T10:15:30.000Z"),
            season: "2025-26",
            gender: "Men",
            selection: "Foil",
            division: "3",
            region: "Northeast",
            conference: "Ivy League",
            rows: [{
                rank: 1,
                school: "Columbia University-Barnard College",
                division: "3",
                conference: "Ivy League",
                region: "Northeast",
                spi: 101.25,
            }],
        });

        expect(csv).toContain("Downloaded at,2026-08-12T10:15:30.000Z");
        expect(csv).toContain("Season,2025-26");
        expect(csv).toContain("Gender,Men");
        expect(csv).toContain("Team/Squad,Foil");
        expect(csv).toContain("Division,III");
        expect(csv).toContain("Region,Northeast");
        expect(csv).toContain("Conference,Ivy League");
        expect(csv).toContain("\n\nRank,School,Division,Conference,Region,SPI\n");
        expect(csv).toContain("1,Columbia University-Barnard College,III,Ivy League,Northeast,101.25");
    });
});
