import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChangePasswordPage from "./ChangePasswordPage";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn() }));
vi.mock("../lib/supabase", () => ({ supabase: { auth: mocks } }));

describe("ChangePasswordPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({ data: { user: { id: "member" } }, error: null });
        mocks.updateUser.mockResolvedValue({ error: null });
    });
    async function submit(confirmation = "new-password") {
        const user = userEvent.setup();
        await user.type(screen.getByLabelText("New password"), "new-password");
        await user.type(screen.getByLabelText("Confirm password"), confirmation);
        await user.click(screen.getByRole("button", { name: "Change password" }));
    }
    it("updates the signed-in account and clears password fields", async () => {
        render(<ChangePasswordPage />);
        await submit();
        expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-password" });
        expect(await screen.findByRole("status")).toHaveTextContent("Password changed");
        expect(screen.getByLabelText("New password")).toHaveValue("");
        expect(screen.getByLabelText("Confirm password")).toHaveValue("");
    });
    it("rejects mismatched passwords without updating the account", async () => {
        render(<ChangePasswordPage />);
        await submit("different-password");
        expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match");
        expect(mocks.updateUser).not.toHaveBeenCalled();
    });
    it("rejects expired sessions", async () => {
        mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
        render(<ChangePasswordPage />);
        await submit();
        expect(await screen.findByRole("alert")).toHaveTextContent("session has expired");
        expect(mocks.updateUser).not.toHaveBeenCalled();
    });
    it("shows server errors and allows a retry", async () => {
        mocks.updateUser.mockResolvedValue({ error: new Error("Choose a stronger password.") });
        render(<ChangePasswordPage />);
        await submit();
        expect(await screen.findByRole("alert")).toHaveTextContent("Choose a stronger password");
        expect(screen.getByRole("button", { name: "Change password" })).toBeEnabled();
    });
});
