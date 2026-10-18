import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Header from "./Header";

describe("Header", () => {
    it("places change password between feedback and the signed-in account", () => {
        render(<Header activePage="spi" user={{ id: "u1", name: "Committee Member", role: "coach", canVote: true }} onSignOut={() => undefined} onFeedback={() => undefined} onSidSignup={() => undefined} />);
        const changePassword = screen.getByRole("link", { name: "Change password" });
        expect(changePassword.previousElementSibling).toBe(screen.getByRole("button", { name: "Give Feedback" }));
        expect(changePassword.nextElementSibling).toBe(screen.getByRole("button", { name: "Committee Member" }));
        expect(screen.getByRole("navigation")).not.toContainElement(changePassword);
    });
    it("uses NCAA Fencing branding and a concise login label", () => {
        render(<Header activePage="spi" user={null} onSignOut={() => undefined} onFeedback={() => undefined} onSidSignup={() => undefined} />);

        expect(screen.getByRole("link", { name: /USFCA.*NCAA Fencing/ })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Give Feedback" })).toBeInTheDocument();
        expect(screen.queryByText("Committee sign in")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Power Ratings" })).not.toBeInTheDocument();
    });
});
