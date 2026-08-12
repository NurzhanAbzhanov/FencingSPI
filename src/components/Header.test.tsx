import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Header from "./Header";

describe("Header", () => {
    it("uses NCAA Fencing branding and a concise login label", () => {
        render(<Header activePage="spi" user={null} onSignOut={() => undefined} />);

        expect(screen.getByRole("link", { name: /USFCA.*NCAA Fencing/ })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
        expect(screen.queryByText("Committee sign in")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Power Ratings" })).not.toBeInTheDocument();
    });
});
