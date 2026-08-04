import type { Program } from "../types/platform";

export default function SchoolLogo({ program, size = "normal" }: { program: Program; size?: "small" | "normal" }) {
    if (program.logoUrl) {
        return <img className={`school-logo ${size}`} src={program.logoUrl} alt="" />;
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
