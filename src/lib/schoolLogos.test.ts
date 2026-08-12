import { describe, expect, it } from "vitest";
import { getSchoolLogoUrl } from "./schoolLogos";

describe("getSchoolLogoUrl", () => {
    it("uses a database logo before the imported mapping", () => {
        expect(getSchoolLogoUrl({ name: "University of Notre Dame", logoUrl: "https://example.com/custom.png" }))
            .toBe("https://example.com/custom.png");
    });

    it.each([
        ["University of Notre Dame", "87"],
        ["Columbia University-Barnard College", "171"],
        ["U.S. Air Force Academy", "2005"],
        ["University of California, San Diego", "28"],
        ["The City College of New York", "2142"],
    ])("resolves the imported logo for %s", (name, espnId) => {
        expect(getSchoolLogoUrl({ name, logoUrl: null }))
            .toBe(`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`);
    });

    it.each([
        ["Notre Dame", "87"],
        ["Air Force", "2005"],
        ["MIT", "137"],
        ["NYU", "160"],
        ["FDU", "2198"],
        ["LIU", "2348"],
        ["UIW", "2916"],
        ["CCNY", "2142"],
    ])("preserves the supplied short-name alias %s", (name, espnId) => {
        expect(getSchoolLogoUrl({ name, logoUrl: null }))
            .toBe(`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`);
    });

    it("returns null when no stored or imported logo exists", () => {
        expect(getSchoolLogoUrl({ name: "Unknown Fencing College", logoUrl: null })).toBeNull();
    });
});
