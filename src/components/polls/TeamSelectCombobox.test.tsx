import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TeamSelectCombobox from "./TeamSelectCombobox";

const teams = [
    { teamId: 1, teamName: "Alpha", logoUrl: null },
    { teamId: 2, teamName: "Beta", logoUrl: null },
    { teamId: 3, teamName: "Gamma", logoUrl: null },
];

describe("TeamSelectCombobox", () => {
    it("searches and prevents selecting a school used in another rank", async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(<TeamSelectCombobox rankNumber={2} selectedTeamId={0} teams={teams} selectedTeamIds={[1, 0]} onSelectTeam={onSelect} />);

        await user.click(screen.getByRole("button", { name: /select rank 2/i }));
        expect(screen.getByRole("option", { name: /alpha/i })).toHaveAttribute("aria-disabled", "true");
        await user.type(screen.getByRole("searchbox"), "Gam");
        await user.click(screen.getByRole("option", { name: /gamma/i }));
        expect(onSelect).toHaveBeenCalledWith(3);
    });

    it("falls back to school initials when a logo cannot load", async () => {
        const user = userEvent.setup();
        const { container } = render(<TeamSelectCombobox
            rankNumber={1}
            selectedTeamId={0}
            teams={[{ teamId: 4, teamName: "Alpha Academy", logoUrl: "https://example.test/missing.png" }]}
            selectedTeamIds={[]}
            onSelectTeam={vi.fn()}
        />);

        await user.click(screen.getByRole("button", { name: /select rank 1/i }));
        fireEvent.error(container.querySelector("img")!);

        expect(screen.getByText("AA")).toBeInTheDocument();
    });
});
