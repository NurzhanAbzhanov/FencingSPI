import { useState } from "react";
import { getSchoolLogoUrl } from "../lib/schoolLogos";
import type { Program } from "../types/platform";

export default function SchoolLogo({ program, size = "normal" }: { program: Program; size?: "small" | "normal" }) {
    const logoUrl = getSchoolLogoUrl(program);
    const [failedUrl, setFailedUrl] = useState<string | null>(null);

    if (logoUrl && failedUrl !== logoUrl) {
        return <img className={`school-logo ${size}`} src={logoUrl} alt="" onError={() => setFailedUrl(logoUrl)} />;
    }

    const initials = program.name
        .split(/\s+/)
        .filter((word) => !["of", "the", "and"].includes(word.toLowerCase()))
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase();

    return <span className={`school-logo-fallback ${size}`} aria-hidden="true">{initials}</span>;
}
