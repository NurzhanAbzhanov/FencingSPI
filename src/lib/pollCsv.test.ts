import { describe, expect, it } from "vitest";
import { createPollResultsCsv } from "./pollCsv";

describe("createPollResultsCsv", () => {
    it("quotes school names and exports the selected category only", () => {
        const csv = createPollResultsCsv([{
            rank: 1,
            teamId: 32,
            teamName: "Columbia University-Barnard College",
            points: 120,
            firstPlaceVotes: 4,
        }]);
        expect(csv).toContain('1,"Columbia University-Barnard College",120,4');
    });
});
