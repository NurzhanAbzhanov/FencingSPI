import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FeedbackDialog from "./FeedbackDialog";
import { submitFeedback } from "../lib/feedbackRepository";

vi.mock("../lib/feedbackRepository", async (importOriginal) => ({ ...await importOriginal<typeof import("../lib/feedbackRepository")>(), submitFeedback: vi.fn() }));
const context = { pageUrl: "https://usfca.org/spi-project/#/spi", season: "2025-26", filters: { gender: "Women", selection: "Foil" } };
beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

describe("FeedbackDialog", () => {
    it("submits without email and attaches page context", async () => {
        vi.mocked(submitFeedback).mockResolvedValue(undefined);
        render(<FeedbackDialog context={context} onClose={() => undefined} />);
        await userEvent.type(screen.getByLabelText("Your feedback"), "The table is difficult to read on my phone.");
        await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
        await screen.findByText("Thank you for helping us improve NCAA Fencing.");
        expect(submitFeedback).toHaveBeenCalledWith(expect.objectContaining({
            kind: "problem", message: "The table is difficult to read on my phone.", email: "", context,
        }));
    });
    it("retains the message on failure and allows retry", async () => {
        vi.mocked(submitFeedback).mockRejectedValueOnce(new Error("Please try again later."));
        render(<FeedbackDialog context={context} onClose={() => undefined} />);
        await userEvent.type(screen.getByLabelText("Your feedback"), "Please add a comparison between seasons.");
        await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Please try again later.");
        expect(screen.getByLabelText("Your feedback")).toHaveValue("Please add a comparison between seasons.");
        expect(screen.getByRole("button", { name: "Send feedback" })).toBeEnabled();
    });
    it("rejects whitespace-only feedback and supports Escape", async () => {
        const close = vi.fn();
        render(<FeedbackDialog context={context} onClose={close} />);
        await userEvent.type(screen.getByLabelText("Your feedback"), "          ");
        await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("at least 10"));
        expect(submitFeedback).not.toHaveBeenCalled();
        fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
        expect(close).toHaveBeenCalled();
    });
});
