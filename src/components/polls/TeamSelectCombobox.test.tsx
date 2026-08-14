import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TeamSelectCombobox from "./TeamSelectCombobox";

const teams = [
    { id: "1", name: "Alpha", logoUrl: null },
    { id: "2", name: "Beta", logoUrl: null },
    { id: "3", name: "Gamma", logoUrl: null },
];

describe("TeamSelectCombobox", () => {
    it("searches and selects an available school", async () => {
        const user = userEvent.setup();
        const onSelectTeam = vi.fn();

        render(<TeamSelectCombobox rankNumber={2} selectedTeamId="" teams={teams} selectedTeamIds={["1"]} onSelectTeam={onSelectTeam} />);

        await user.click(screen.getByRole("button", { name: /select rank 2/i }));
        await user.type(screen.getByPlaceholderText(/search teams/i), "Gam");
        await user.click(screen.getByRole("button", { name: /gamma/i }));

        expect(onSelectTeam).toHaveBeenCalledWith("3");
    });
});
