import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Footer from "./Footer";

it("credits the Innovation Hub in a semantic footer", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Powered by UC San Diego Fencing Innovation Hub");
});
