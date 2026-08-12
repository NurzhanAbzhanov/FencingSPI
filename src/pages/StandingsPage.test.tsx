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
    it("starts with men's Team SPI and selects one squad at a time", async () => {
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

        const teamSquadFilter = screen.getByLabelText("Team/Squad");
        expect(teamSquadFilter).toHaveValue("Team");
        expect(within(teamSquadFilter).queryByRole("option", { name: "All" })).not.toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: "Gender" })).not.toBeInTheDocument();

        await user.selectOptions(teamSquadFilter, "Foil");

        expect(screen.getByRole("heading", { name: "Squad SPI" })).toBeInTheDocument();
        expect(screen.getByLabelText("Team/Squad")).toHaveValue("Foil");
    });

    it("can open directly on a single squad for a compatible legacy route", () => {
        render(<StandingsPage
            initialWeapon="Epee"
            programs={programs}
            standings={standings}
            pollResults={[]}
            season="2025-26"
            onSeasonChange={() => undefined}
        />);

        expect(screen.getByRole("heading", { name: "Squad SPI" })).toBeInTheDocument();
        expect(screen.getByLabelText("Team/Squad")).toHaveValue("Epee");
    });

    it("updates the selection when legacy hash navigation changes the initial weapon", () => {
        const { rerender } = render(<StandingsPage
            key="Team"
            initialWeapon="Team"
            programs={programs}
            standings={standings}
            pollResults={[]}
            season="2025-26"
            onSeasonChange={() => undefined}
        />);

        rerender(<StandingsPage
            key="Sabre"
            initialWeapon="Sabre"
            programs={programs}
            standings={standings}
            pollResults={[]}
            season="2025-26"
            onSeasonChange={() => undefined}
        />);

        expect(screen.getByRole("heading", { name: "Squad SPI" })).toBeInTheDocument();
        expect(screen.getByLabelText("Team/Squad")).toHaveValue("Sabre");
    });
});
