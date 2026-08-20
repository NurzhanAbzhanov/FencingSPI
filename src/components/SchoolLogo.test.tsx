import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SchoolLogo from "./SchoolLogo";

const program = {
    id: 67,
    name: "University of Notre Dame",
    gender: "Men" as const,
    division: "1",
    conference: "ACC",
    conferences: ["ACC"],
    region: "Midwest",
    logoUrl: null,
};

describe("SchoolLogo", () => {
    it("falls back to stable initials when the image cannot load", () => {
        const { container } = render(<SchoolLogo program={program} />);
        fireEvent.error(container.querySelector("img")!);
        expect(screen.getByText("UN")).toBeInTheDocument();
    });

    it("uses a compact fixed-size class in table rows", () => {
        const { container } = render(<SchoolLogo program={program} size="small" />);
        expect(container.querySelector("img")).toHaveClass("school-logo", "small");
    });
});
