import { describe, expect, it } from "vitest";
import { getRouteFromHash } from "./lib/appRoute";

describe("getRouteFromHash", () => {
    it("keeps the legacy squad standings route in Squad view", () => {
        window.location.hash = "#/squad-spi";

        expect(getRouteFromHash()).toEqual({ page: "spi", initialMode: "Squad" });
    });
});
