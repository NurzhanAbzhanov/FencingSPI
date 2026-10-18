import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SidSignupDialog from "./SidSignupDialog";
import { registerSid } from "../lib/sidRepository";
vi.mock("../lib/sidRepository", () => ({ registerSid: vi.fn() }));
beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
describe("SID signup", () => {
    it("sends name, school and email and confirms successful registration", async () => {
        vi.mocked(registerSid).mockResolvedValue(undefined);
        render(<SidSignupDialog schools={["Duke University"]} onClose={() => undefined} />);
        await userEvent.type(screen.getByLabelText("SID name"), "Taylor Smith");
        await userEvent.type(screen.getByLabelText("School"), "Duke University");
        await userEvent.type(screen.getByLabelText("Email"), "taylor@example.edu");
        await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
        expect(await screen.findByText("Your Sports Information Director registration has been received.")).toBeInTheDocument();
        expect(registerSid).toHaveBeenCalledWith(expect.objectContaining({ name: "Taylor Smith", school: "Duke University", email: "taylor@example.edu" }));
    });
    it("keeps entered details when submission fails", async () => {
        vi.mocked(registerSid).mockRejectedValue(new Error("Please try again later."));
        render(<SidSignupDialog schools={[]} onClose={() => undefined} />);
        await userEvent.type(screen.getByLabelText("SID name"), "Taylor Smith");
        await userEvent.type(screen.getByLabelText("School"), "New school");
        await userEvent.type(screen.getByLabelText("Email"), "taylor@example.edu");
        await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Please try again later.");
        expect(screen.getByLabelText("School")).toHaveValue("New school");
        expect(screen.getByRole("button", { name: "Sign up" })).toBeEnabled();
    });
});
