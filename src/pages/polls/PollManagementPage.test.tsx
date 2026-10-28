import { render, screen, within } from "@testing-library/react";
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), loadPollPeriods: vi.fn(), openPoll: vi.fn(), closePoll: vi.fn(), publishPoll: vi.fn(), schedulePoll: vi.fn() }));
vi.mock("../../lib/pollAdminRepository", () => mocks);
vi.mock("../../lib/supabase", () => ({ supabase: { from: mocks.from } }));
import PollManagementPage from "./PollManagementPage";

describe("PollManagementPage", () => {
    let polls: Array<{ id: string; label: string; status: string; opens_at: null; closes_at: null }>;
    beforeEach(() => {
        vi.clearAllMocks();
        polls = [
            { id: 'october', label: 'October', status: 'closed', opens_at: null, closes_at: null },
            { id: 'november', label: 'November', status: 'draft', opens_at: null, closes_at: null },
            { id: 'december', label: 'December', status: 'published', opens_at: null, closes_at: null },
        ];
        mocks.from.mockImplementation(() => ({ select: () => ({ order: async () => ({ data: polls, error: null }) }) }));
        mocks.publishPoll.mockImplementation(async () => { polls = polls.map((p) => p.id === 'october' ? { ...p, status: 'published' } : p); });
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });
    afterEach(() => vi.restoreAllMocks());

    it('publishes a closed poll through the server and refreshes its status', async () => {
        render(<PollManagementPage />);
        await userEvent.click(await screen.findByRole('button', { name: 'Publish results' }));
        expect(mocks.publishPoll).toHaveBeenCalledWith('october');
        expect(await screen.findByText('Poll results published.')).toBeInTheDocument();
        const row = screen.getByRole('cell', { name: 'October' }).closest('tr')!;
        expect(within(row).getByText('Published')).toBeInTheDocument();
        expect(within(row).queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
        expect(within(row).queryByRole('button', { name: 'Publish results' })).not.toBeInTheDocument();
    });

    it('does not publish when confirmation is cancelled', async () => {
        vi.mocked(window.confirm).mockReturnValue(false);
        render(<PollManagementPage />);
        await userEvent.click(await screen.findByRole('button', { name: 'Publish results' }));
        expect(mocks.publishPoll).not.toHaveBeenCalled();
    });

    it('shows server errors without marking the poll as published', async () => {
        mocks.publishPoll.mockRejectedValueOnce(new Error('There are no submitted ballots to publish'));
        render(<PollManagementPage />);
        await userEvent.click(await screen.findByRole('button', { name: 'Publish results' }));
        expect(await screen.findByText('There are no submitted ballots to publish')).toBeInTheDocument();
        expect(within(screen.getByRole('cell', { name: 'October' }).closest('tr')!).getByText('Closed')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Publish results' })).toBeEnabled();
    });

    it('offers publishing only for closed polls and protects published results', async () => {
        render(<PollManagementPage />);
        await screen.findByRole('button', { name: 'Publish results' });
        const draft = screen.getByRole('cell', { name: 'November' }).closest('tr')!;
        const published = screen.getByRole('cell', { name: 'December' }).closest('tr')!;
        expect(within(draft).getByText('Draft')).toBeInTheDocument();
        expect(within(draft).queryByRole('button', { name: 'Publish results' })).not.toBeInTheDocument();
        expect(within(published).queryByRole('button', { name: 'Publish results' })).not.toBeInTheDocument();
        expect(within(published).getByRole('button', { name: 'Delete' })).toBeDisabled();
        expect(within(published).getByRole('link', { name: 'Public results' })).toHaveAttribute('href', '#/polls/public/december');
    });
    it("shows state-specific controls", async () => {
        mocks.loadPollPeriods.mockResolvedValue([{ id: "p1", label: "October", seasonSlug: "2025-26", status: "draft", opensAt: null, closesAt: null, effectivelyOpen: false, snapshotCapturedAt: null }]);
        render(<PollManagementPage season="2025-26" />);
        expect(await screen.findByRole("button", { name: "Create Poll" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Manage Polls" })).toBeInTheDocument();
    });
});
