import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    loadRecords: vi.fn(),
    loadOverrides: vi.fn(),
    loadSeasons: vi.fn(),
    parseFile: vi.fn(),
    recalculate: vi.fn(),
}));

vi.mock("../lib/powerRatingOverrides", () => ({
    createOverrideKey: ({ teamId, gender, weapon }: { teamId: number; gender: string; weapon: string }) => `${teamId}:${gender}:${weapon}`,
    deletePowerRatingOverride: vi.fn(),
    loadPowerRatingOverrides: mocks.loadOverrides,
    loadPowerRatingRecords: mocks.loadRecords,
    loadPowerRatingSeasons: mocks.loadSeasons,
    parseFencerRatingFile: mocks.parseFile,
    recalculatePowerRatings: mocks.recalculate,
    savePowerRatingOverride: vi.fn(),
}));

import PowerRatingsPage from "./PowerRatingsPage";

describe("PowerRatingsPage", () => {
    it('validates both files before replacing either gender', async () => {
        mocks.parseFile.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Could not read women.xlsx'));
        render(<PowerRatingsPage embedded programs={[]} season="2026-27" user={{id:'admin',name:'Admin',role:'admin',canVote:true}} />);
        await userEvent.upload(await screen.findByLabelText('Men fencer ratings'),new File(['data'],'men.xlsx'));
        await userEvent.upload(screen.getByLabelText('Women fencer ratings'),new File(['data'],'women.xlsx'));
        await userEvent.click(screen.getByRole('button',{name:'Recalculate power ratings'}));
        expect(await screen.findByText('Could not read women.xlsx')).toBeInTheDocument();
        expect(mocks.recalculate).not.toHaveBeenCalled();
    });
    it('calculates valid rows and displays missing-cell issues', async () => {
        mocks.parseFile.mockImplementation(async (_file, issues) => {
            issues.push({row: 269, message: 'Missing weapon; program PRs unavailable.'});
            return [{teamName:'Duke University',weapon:null,powerRating:70}];
        });
        render(<PowerRatingsPage embedded programs={[]} season="2026-27" user={{id:'admin',name:'Admin',role:'admin',canVote:true}} />);
        await userEvent.upload(await screen.findByLabelText('Women fencer ratings'),new File(['data'],'women.xlsx'));
        await userEvent.click(screen.getByRole('button',{name:'Recalculate power ratings'}));
        await waitFor(() => expect(mocks.recalculate).toHaveBeenCalledWith('2026-27','Women',[
            {teamName:'Duke University',weapon:null,powerRating:70},
        ],'women.xlsx'));
        expect(screen.getByText(/women.xlsx, row 269/)).toBeInTheDocument();
    });
    it('does not replace an empty gender upload while processing the other file', async () => {
        mocks.parseFile.mockResolvedValueOnce([]).mockResolvedValueOnce([
            {teamName:'Duke University',weapon:'Foil',powerRating:70},
        ]);
        render(<PowerRatingsPage embedded programs={[]} season="2026-27" user={{id:'admin',name:'Admin',role:'admin',canVote:true}} />);
        await userEvent.upload(await screen.findByLabelText('Men fencer ratings'),new File(['data'],'men.xlsx'));
        await userEvent.upload(screen.getByLabelText('Women fencer ratings'),new File(['data'],'women.xlsx'));
        await userEvent.click(screen.getByRole('button',{name:'Recalculate power ratings'}));
        await waitFor(() => expect(mocks.recalculate).toHaveBeenCalledTimes(1));
        expect(mocks.recalculate.mock.calls[0][1]).toBe('Women');
        expect(screen.getByText(/men.xlsx: no assignable rows/)).toBeInTheDocument();
    });
    it('does not display unknown power ratings as zero', async () => {
        render(<PowerRatingsPage embedded programs={[{ id:49,name:'Boston College',gender:'Men',division:'1',conference:'ACC',conferences:['ACC'],region:'Northeast',logoUrl:null }]}
            season="2026-27" user={{id:'admin',name:'Admin',role:'admin',canVote:true}} />);
        await screen.findByText('Boston College');
        const row=screen.getByText('Boston College').closest('tr')!;
        expect(row.querySelector('.effective-rating')).toHaveTextContent('—');
        expect(row.querySelectorAll('.numeric')[0]).toHaveTextContent('—');
    });
    beforeEach(() => {
        mocks.loadRecords.mockReset().mockResolvedValue([]);
        mocks.loadOverrides.mockReset().mockResolvedValue([]);
        mocks.loadSeasons.mockReset().mockResolvedValue(["2026-27", "2025-26"]);
        mocks.parseFile.mockReset().mockResolvedValue([
            { teamName: "Boston College", weapon: "Epee", powerRating: 90 },
        ]);
        mocks.recalculate.mockReset().mockResolvedValue(undefined);
        vi.spyOn(window, "confirm").mockReturnValue(true);
    });

    it("recalculates a gender from an uploaded fencer-rating file and refreshes records", async () => {
        const user = userEvent.setup();
        const onRatingsChanged = vi.fn();
        render(<PowerRatingsPage
            embedded
            onRatingsChanged={onRatingsChanged}
            programs={[{
                id: 49,
                name: "Boston College",
                gender: "Men",
                division: "1",
                conference: "ACC",
                conferences: ["ACC"],
                region: "Northeast",
                logoUrl: null,
            }]}
            season="2025-26"
            user={{ id: "admin", name: "Admin", role: "admin", canVote: true }}
        />);

        expect(screen.queryByRole("textbox", { name: "Recalculation season" })).not.toBeInTheDocument();
        await user.click(await screen.findByRole("button", { name: "2026-27" }));
        const file = new File(["ratings"], "men-ratings.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        await user.upload(await screen.findByLabelText("Men fencer ratings"), file);
        await user.click(screen.getByRole("button", { name: "Recalculate power ratings" }));

        await waitFor(() => expect(mocks.recalculate).toHaveBeenCalledWith(
            "2026-27",
            "Men",
            [{ teamName: "Boston College", weapon: "Epee", powerRating: 90 }],
            "men-ratings.xlsx"
        ));
        expect(mocks.loadRecords).toHaveBeenCalledTimes(1);
        expect(onRatingsChanged).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("status")).toHaveTextContent("Power ratings recalculated");
        expect(screen.getByRole("region", { name: "Power Ratings" })).toBeInTheDocument();
    });
});
