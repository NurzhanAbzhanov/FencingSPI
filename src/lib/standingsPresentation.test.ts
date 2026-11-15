import { describe, expect, it } from "vitest";
import { createStandingsCsv, formatDivision, createWinLossRecords, formatWinLossRecord } from "./standingsPresentation";
import type { SeasonMatch } from "../types/platform";

describe('win/loss records', () => {
    const match: SeasonMatch = {id:1,date:'2026-11-01',gender:'Men',leftTeamId:1,rightTeamId:2,
        leftEpee:6,rightEpee:3,leftFoil:2,rightFoil:7,leftSabre:8,rightSabre:1,host:'Test'};
    it('counts meets rather than bouts and credits both opponents', () => {
        const records=createWinLossRecords([match],'Team');
        expect(formatWinLossRecord(records.get(1))).toBe('1-0');
        expect(formatWinLossRecord(records.get(2))).toBe('0-1');
        expect(formatWinLossRecord(createWinLossRecords([match],'Foil').get(1))).toBe('0-1');
        expect(formatWinLossRecord(createWinLossRecords([match],'Epee').get(1))).toBe('1-0');
        expect(formatWinLossRecord(createWinLossRecords([match],'Sabre').get(2))).toBe('0-1');
    });
    it('retains ties, skips unfenced 0-0 weapons and leaves missing records unavailable', () => {
        const records=createWinLossRecords([{...match,leftEpee:4,rightEpee:4}],'Epee');
        expect(formatWinLossRecord(records.get(1))).toBe('0-0-1');
        expect(createWinLossRecords([{...match,leftFoil:0,rightFoil:0}],'Foil').size).toBe(0);
        expect(formatWinLossRecord(undefined)).toBe('—');
    });
});

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
    it('exports coverage alongside provisional SPI', () => {
        const csv=createStandingsCsv({ downloadedAt:new Date(),season:'2026-27',gender:'Men',selection:'Foil',division:'All',region:'All',conference:'All',includeCoverage:true,
            rows:[{rank:1,school:'Partial School',division:'1',conference:'ACC',region:'West',spi:50,record:'1-0',includedResults:1,excludedResults:2,isProvisional:true}] });
        expect(csv).toContain('SPI,W-L,Included results,Excluded results,Provisional');
        expect(csv).toContain('50,1-0,1,2,Yes');
    });
    it("leaves uncalculated SPI and unranked schools blank", () => {
        const csv = createStandingsCsv({ downloadedAt: new Date(), season: '2026-27', gender: 'Men', selection: 'Team', division: 'All', region: 'All', conference: 'All',
            rows: [{ rank: null, school: 'New school', division: '3', conference: 'Test', region: 'West', spi: null }] });
        expect(csv).toContain('\n,New school,III,Test,West,');
        expect(csv).not.toContain('null');
    });
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
        expect(csv).toContain("\n\nRank,School,Division,Conference,Region,SPI,W-L\n");
        expect(csv).toContain("1,Columbia University-Barnard College,III,Ivy League,Northeast,101.25");
    });
});
