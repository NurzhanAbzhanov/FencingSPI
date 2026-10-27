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
    conferences: ["Test Conference", "Second Conference"],
    region: "Test Region",
    logoUrl: null,
}];

const standings: Standing[] = [
    { teamId: 1, teamName: "Test University", gender: "Men", weapon: "Team", spi: 100 },
    { teamId: 1, teamName: "Test University", gender: "Men", weapon: "Foil", spi: 90 },
];

describe("StandingsPage", () => {
    it("shows schools and published October ranks without inventing preseason SPI", () => {
        render(<StandingsPage programs={programs} standings={[]} season="2026-27" onSeasonChange={() => undefined}
            pollResults={[{ definitionId: 'october', teamId: 1, month: 'October', gender: 'Men', weapon: 'Team', scope: 'Overall', rank: 2, points: 100 }]} />);
        const row = screen.getByText('Test University').closest('tr')!;
        expect(within(row).getAllByRole('cell', { name: '2' })).toHaveLength(2);
        expect(row.querySelector('.spi-cell')).toHaveTextContent('—');
        expect(screen.queryByText('0.00')).not.toBeInTheDocument();
    });
    it("leaves schools without verified profiles unlinked while keeping the Results action", () => {
        render(<StandingsPage programs={[{ ...programs[0], id: 49, name: "Boston College" }]}
            standings={[{ ...standings[0], teamId: 49 }]} pollResults={[]} season="2025-26" onSeasonChange={() => undefined} />);
        expect(screen.getByText("Boston College")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Boston College" })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "#/schools/49/results?season=2025-26");
    });
    it("preserves filters and sorting through season loading, errors and changed options", async () => {
        const user = userEvent.setup();
        const props = { programs, standings, pollResults: [], season: "2025-26", onSeasonChange: () => undefined };
        const { rerender } = render(<StandingsPage {...props} />);
        await user.selectOptions(screen.getByLabelText("Gender"), "Women");
        await user.selectOptions(screen.getByLabelText("Team/Squad"), "Epee");
        await user.selectOptions(screen.getByLabelText("Division"), "3");
        await user.selectOptions(screen.getByLabelText("Region"), "Test Region");
        await user.selectOptions(screen.getByLabelText("Conference"), "Second Conference");
        await user.click(screen.getByRole("button", { name: "School" }));
        for (const state of [{ loading: true }, { loadError: true }, {}]) {
            rerender(<StandingsPage {...props} season="2024-25" programs={[]} standings={[]} {...state} />);
            expect(screen.getByLabelText("Gender")).toHaveValue("Women");
            expect(screen.getByLabelText("Team/Squad")).toHaveValue("Epee");
            expect(screen.getByLabelText("Division")).toHaveValue("3");
            expect(screen.getByLabelText("Region")).toHaveValue("Test Region");
            expect(screen.getByLabelText("Conference")).toHaveValue("Second Conference");
            expect(screen.getByRole("button", { name: /School/ })).toHaveTextContent("▲");
            expect(screen.getByRole("button", { name: "Download selection" })).toBeDisabled();
        }
    });

    it("opens verified school profiles separately and preserves season-results links", () => {
        render(<StandingsPage programs={[{ ...programs[0], id: 67, name: "Notre Dame" }]}
            standings={[{ ...standings[0], teamId: 67 }]} pollResults={[]} season="2025-26" onSeasonChange={() => undefined} />);
        const link = screen.getByRole("link", { name: "Notre Dame" });
        expect(link).toHaveAttribute("href", "https://usfca.org/college-team-profile/?InstitutionId=18");
        expect(link).toHaveAttribute("target", "_blank");
        expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "#/schools/67/results?season=2025-26");
    });
    it("preserves historical labels, tied places and source links", () => {
        render(<StandingsPage programs={programs} standings={standings} season="2024-25" onSeasonChange={() => undefined} pollResults={[
            { definitionId: "a", teamId: 1, month: "Preseason", gender: "Men", weapon: "Team", scope: "Overall", rank: 15, points: 15, sourceUrl: "https://usfca.org/poll.pdf" },
            { definitionId: "b", teamId: 2, month: "Preseason", gender: "Men", weapon: "Team", scope: "Overall", rank: 15, points: 15 },
        ]} />);
        expect(screen.getByRole("columnheader", { name: "Preseason poll" })).toBeInTheDocument();
        expect(screen.getByText("T15")).toHaveAttribute("title", "15 points");
        expect(screen.getByRole("link", { name: "Source 1" })).toHaveAttribute("href", "https://usfca.org/poll.pdf");
    });
    it("keeps four poll columns visible before the new season starts", () => {
        render(<StandingsPage programs={programs} standings={[]} pollResults={[]} season="2026-27" onSeasonChange={() => undefined} />);
        expect(screen.getByText("Season not started")).toBeInTheDocument();
        for (const month of ["Oct", "Nov", "Dec", "Jan"]) {
            expect(screen.getByRole("columnheader", { name: `${month} poll` })).toBeInTheDocument();
        }
    });
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
        expect(screen.getByRole("cell", { name: "100.00" })).toBeInTheDocument();
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

    it("filters a program by any of its conference memberships", async () => {
        const user = userEvent.setup();
        render(<StandingsPage
            programs={programs}
            standings={standings}
            pollResults={[]}
            season="2025-26"
            onSeasonChange={() => undefined}
        />);

        const conferenceFilter = screen.getByLabelText("Conference");
        expect(within(conferenceFilter).getByRole("option", { name: "Second Conference" })).toBeInTheDocument();

        await user.selectOptions(conferenceFilter, "Second Conference");

        expect(screen.getByRole("cell", { name: "Test University" })).toBeInTheDocument();
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
