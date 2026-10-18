import { afterEach, describe, expect, it } from "vitest";
import { publicAsset } from "./publicAsset";

afterEach(() => { delete window.NCAA_FENCING_ASSET_BASE; });

describe("WordPress asset URLs", () => {
    it("preserves existing standalone paths", () => {
        expect(publicAsset("/usfca-logo.png")).toBe("/usfca-logo.png");
    });
    it("resolves bundled logos under the plugin while preserving external logos", () => {
        window.NCAA_FENCING_ASSET_BASE = "https://example.org/wp-content/plugins/ncaa-fencing/app/";
        expect(publicAsset("/school-logos/mit.webp")).toBe("https://example.org/wp-content/plugins/ncaa-fencing/app/school-logos/mit.webp");
        expect(publicAsset("https://cdn.example.org/logo.png")).toBe("https://cdn.example.org/logo.png");
        expect(publicAsset("//cdn.example.org/logo.png")).toBe("//cdn.example.org/logo.png");
    });
});
