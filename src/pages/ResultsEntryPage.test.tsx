import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResultsEntryPage from "./ResultsEntryPage";

vi.mock("../lib/powerRatingOverrides", () => ({
    loadPowerRatingSeasons: vi.fn().mockResolvedValue(["2026-27", "2025-26", "2024-25"]),
}));

describe("match entry season selection", () => {
    it("loads database seasons and requests the selected season without saving a match", async () => {
        const change = vi.fn();
        const save = vi.fn();
        render(<ResultsEntryPage season="2025-26" onSeasonChange={change}
            teams={[]} submissions={[]} onSaveSubmission={save} onDeleteSubmission={vi.fn()} />);
        await screen.findByRole("option", { name: "2026-27" });
        expect(screen.getByRole("combobox", { name: "Season" })).toHaveValue("2025-26");
        fireEvent.change(screen.getByRole("combobox", { name: "Season" }), { target: { value: "2024-25" } });
        expect(change).toHaveBeenCalledWith("2024-25");
        expect(save).not.toHaveBeenCalled();
    });
});
