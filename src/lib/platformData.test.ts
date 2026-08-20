import { beforeEach, describe, expect, it } from "vitest";
import { readLocalPrograms } from "./platformData";

describe("readLocalPrograms", () => {
    beforeEach(() => localStorage.clear());

    it("upgrades programs saved before multiple conference memberships existed", () => {
        localStorage.setItem("spi-local-programs", JSON.stringify([{
            id: 1,
            name: "Legacy University",
            gender: "Men",
            division: "1",
            conference: "ACC",
            region: "East",
            logoUrl: null,
        }]));

        expect(readLocalPrograms()[0].conferences).toEqual(["ACC"]);
    });
});
