import { describe, expect, it } from "vitest";
import { getRouteFromHash } from "./lib/appRoute";

describe("getRouteFromHash", () => {
    it("keeps the legacy squad standings route in Squad view", () => {
        window.location.hash = "#/squad-spi";

        expect(getRouteFromHash()).toEqual({ page: "spi", initialWeapon: "Epee" });
    });

    it("does not expose power ratings as a standalone route", () => {
        window.location.hash = "#/power-ratings";

        expect(getRouteFromHash()).toEqual({ page: "spi" });
    });
});
