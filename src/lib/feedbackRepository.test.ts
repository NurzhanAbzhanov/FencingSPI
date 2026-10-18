import { describe, expect, it, vi } from "vitest";
import { prepareFeedbackScreenshot, safeFeedbackPageUrl, submitFeedback } from "./feedbackRepository";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("./supabase", () => ({ supabase: { rpc } }));

describe("feedback", () => {
    it("rejects SVGs and oversized images before decoding", async () => {
        await expect(prepareFeedbackScreenshot(new File(["<svg></svg>"], "image.svg", { type: "image/svg+xml" }))).rejects.toThrow("PNG, JPEG or WebP");
        await expect(prepareFeedbackScreenshot(new File([new Uint8Array(11 * 1024 * 1024)], "big.png", { type: "image/png" }))).rejects.toThrow("10 MB");
    });
    it("does not collect URL credentials, auth fragments or queries", () => {
        expect(safeFeedbackPageUrl("https://name:secret@usfca.org/spi-project/?token=secret#access_token=secret"))
            .toBe("https://usfca.org/spi-project/");
        expect(safeFeedbackPageUrl("https://usfca.org/spi-project/#/spi?access_token=secret"))
            .toBe("https://usfca.org/spi-project/#/spi");
    });
    it("submits through the restricted RPC, not a public table write", async () => {
        rpc.mockResolvedValue({ error: null });
        await submitFeedback({ requestId: "request", clientId: "client", kind: "suggestion", message: "A useful suggestion", email: "", screenshot: null,
            context: { pageUrl: "https://usfca.org/#/spi", season: "2025-26" }, website: "" });
        expect(rpc).toHaveBeenCalledWith("submit_site_feedback", expect.objectContaining({ p_kind: "suggestion", p_message: "A useful suggestion", p_email: null }));
    });
});
