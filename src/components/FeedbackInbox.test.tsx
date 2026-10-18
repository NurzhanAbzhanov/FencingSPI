import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FeedbackInbox from "./FeedbackInbox";
import { loadFeedback, loadFeedbackScreenshot, updateFeedbackStatus } from "../lib/feedbackRepository";

vi.mock("../lib/feedbackRepository", () => ({ loadFeedback: vi.fn(), loadFeedbackScreenshot: vi.fn(), updateFeedbackStatus: vi.fn() }));
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadFeedback).mockResolvedValue([{ id: "test", kind: "suggestion", message: "Make the tables easier to read.", email: null,
        created_at: "2026-09-16T12:00:00Z", status: "new", context: { pageUrl: "https://usfca.org/#/spi", season: "2025-26" }, has_screenshot: true }]);
});
describe("FeedbackInbox", () => {
    it("loads on demand and updates status only after persistence", async () => {
        vi.mocked(updateFeedbackStatus).mockResolvedValue(undefined);
        render(<FeedbackInbox />);
        expect(loadFeedback).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole("button", { name: "Load feedback" }));
        await screen.findByText("Make the tables easier to read.");
        expect(loadFeedbackScreenshot).not.toHaveBeenCalled();
        await userEvent.selectOptions(screen.getByLabelText("Status"), "resolved");
        expect(updateFeedbackStatus).toHaveBeenCalledWith("test", "resolved");
        expect(screen.getByLabelText("Status")).toHaveValue("resolved");
    });
    it("keeps the old status if updating fails", async () => {
        vi.mocked(updateFeedbackStatus).mockRejectedValue(new Error("Please retry."));
        render(<FeedbackInbox />);
        await userEvent.click(screen.getByRole("button", { name: "Load feedback" }));
        await screen.findByText("Make the tables easier to read.");
        await userEvent.selectOptions(screen.getByLabelText("Status"), "resolved");
        expect(await screen.findByRole("alert")).toHaveTextContent("Please retry.");
        expect(screen.getByLabelText("Status")).toHaveValue("new");
    });
});
