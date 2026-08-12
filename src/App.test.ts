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

    it.each([
        ["#/polls", { page: "polls" }],
        ["#/polls/vote/men_team_overall", { page: "poll-ballot", slug: "men_team_overall" }],
        ["#/polls/results/period-1", { page: "poll-results", periodId: "period-1" }],
        ["#/polls/public/period-1", { page: "public-poll-results", periodId: "period-1" }],
        ["#/admin/polls", { page: "admin-polls" }],
        ["#/admin/coaches", { page: "admin-coaches" }],
        ["#/admin/participation/period-1", { page: "admin-participation", periodId: "period-1" }],
    ])("parses replacement poll route %s", (hash, expected) => {
        window.location.hash = hash;
        expect(getRouteFromHash()).toEqual(expected);
    });

    it("marks unknown ballot categories explicitly", () => {
        window.location.hash = "#/polls/vote/not-a-category";
        expect(getRouteFromHash()).toEqual({ page: "invalid-ballot" });
    });
});
