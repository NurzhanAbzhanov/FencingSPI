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
        ["University of Detroit Mercy", "2174"],
        ["Fairleigh Dickinson University, Metropolitan Campus", "161"],
        ["Lafayette College", "322"],
        ["Long Island University", "112358"],
        ["New Jersey Institute of Technology", "2885"],
    ])("resolves the imported logo for %s", (name, espnId) => {
        expect(getSchoolLogoUrl({ name, logoUrl: null }))
            .toBe(`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`);
    });

    it.each([
        ["Notre Dame", "87"],
        ["Air Force", "2005"],
        ["FDU", "161"],
        ["LIU", "112358"],
        ["UIW", "2916"],
    ])("preserves the supplied short-name alias %s", (name, espnId) => {
        expect(getSchoolLogoUrl({ name, logoUrl: null }))
            .toBe(`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`);
    });

    it.each([
        ["Brandeis University", "brandeis"],
        ["The City College of New York", "ccny"],
        ["Denison University", "denison"],
        ["Drew University", "drew"],
        ["Haverford College", "haverford"],
        ["Hunter College", "hunter"],
        ["Johns Hopkins University", "johns-hopkins"],
        ["Lawrence University", "lawrence"],
        ["Massachusetts Institute of Technology", "mit"],
        ["New York University", "nyu"],
        ["Stevens Institute of Technology", "stevens"],
        ["Tufts University", "tufts"],
        ["Vassar College", "vassar"],
        ["Wellesley College", "wellesley"],
        ["Wheaton College (Massachusetts)", "wheaton-ma"],
        ["Yeshiva University", "yeshiva"],
    ])("resolves the official local DIII logo for %s", (name, slug) => {
        expect(getSchoolLogoUrl({ name, logoUrl: null })).toBe(`/school-logos/${slug}.webp`);
    });

    it("resolves Wayne State's official local logo", () => {
        expect(getSchoolLogoUrl({ name: "Wayne State University (Michigan)", logoUrl: null }))
            .toBe("/school-logos/wayne-state.webp");
    });

    it("returns null when no stored or imported logo exists", () => {
        expect(getSchoolLogoUrl({ name: "Unknown Fencing College", logoUrl: null })).toBeNull();
    });
});
