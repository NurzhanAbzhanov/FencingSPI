import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import StandingsPage from "./StandingsPage";
import type { Program, Standing } from "../types/platform";

const programs: Program[] = [{
    id: 1,
    name: "Test University",
    gender: "Men",
    division: "1",
    conference: "Test Conference",
    region: "Test Region",
    logoUrl: null,
}];

const standings: Standing[] = [
    { teamId: 1, teamName: "Test University", gender: "Men", weapon: "Team", spi: 100 },
    { teamId: 1, teamName: "Test University", gender: "Men", weapon: "Foil", spi: 90 },
];

describe("StandingsPage", () => {
    it("starts with men's Team SPI and switches to Squad SPI in place", async () => {
        const user = userEvent.setup();
        render(<StandingsPage
            programs={programs}
            standings={standings}
            pollResults={[]}
            season="2025-26"
            onSeasonChange={() => undefined}
        />);

        expect(screen.getByRole("heading", { name: "Team SPI" })).toBeInTheDocument();
        const genderFilter = screen.getByLabelText("Gender");
        expect(genderFilter).toHaveValue("Men");
        expect(within(genderFilter).queryByRole("option", { name: "All" })).not.toBeInTheDocument();
        expect(screen.getByRole("cell", { name: "I" })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Squad" }));

        expect(screen.getByRole("heading", { name: "Squad SPI" })).toBeInTheDocument();
        expect(screen.getByLabelText("Squad")).toHaveValue("All");
    });

    it("can open directly in Squad view for a compatible legacy route", () => {
        render(<StandingsPage
            initialMode="Squad"
            programs={programs}
            standings={standings}
            pollResults={[]}
            season="2025-26"
            onSeasonChange={() => undefined}
        />);

        expect(screen.getByRole("heading", { name: "Squad SPI" })).toBeInTheDocument();
        expect(screen.getByLabelText("Squad")).toBeInTheDocument();
    });

    it("updates the view when legacy hash navigation changes the initial mode", () => {
        const { rerender } = render(<StandingsPage
            key="Team"
            initialMode="Team"
            programs={programs}
            standings={standings}
            pollResults={[]}
            season="2025-26"
            onSeasonChange={() => undefined}
        />);

        rerender(<StandingsPage
            key="Squad"
            initialMode="Squad"
            programs={programs}
            standings={standings}
            pollResults={[]}
            season="2025-26"
            onSeasonChange={() => undefined}
        />);

        expect(screen.getByRole("heading", { name: "Squad SPI" })).toBeInTheDocument();
    });
});
