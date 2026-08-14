import { getPollCategorySpec } from "./pollDomain";
import type { PollCategorySlug } from "../types/polls";
import type { Weapon } from "../types/types";

export type Route =
    | { page: "spi"; initialWeapon?: Weapon }
    | { page: "enter-results" | "polls" | "admin" | "sign-in" | "set-password" }
    | { page: "school-results"; teamId: number; season: string }
    | { page: "poll-ballot"; slug: PollCategorySlug }
    | { page: "poll-results" | "public-poll-results"; periodId: string }
    | { page: "admin-polls" | "admin-coaches" }
    | { page: "admin-participation"; periodId: string }
    | { page: "invalid-ballot" };

export function getRouteFromHash(): Route {
    const raw = window.location.hash.replace(/^#\/?/, "");
    const [path, query = ""] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    const searchParams = new URLSearchParams(query);

    if (parts[0] === "team-spi") return { page: "spi", initialWeapon: "Team" };
    if (parts[0] === "squad-spi") return { page: "spi", initialWeapon: "Epee" };
    if (parts[0] === "schools" && parts[2] === "results") return { page: "school-results", teamId: Number(parts[1]), season: searchParams.get("season") ?? "2025-26" };
    if (parts[0] === "polls" && (parts[1] === "vote" || parts[1] === "ballots")) {
        const rawSlug = parts[2];
        try {
            const spec = getPollCategorySpec(rawSlug);
            return spec && !spec.hidden ? { page: "poll-ballot", slug: spec.slug } : { page: "invalid-ballot" };
        } catch {
            return { page: "invalid-ballot" };
        }
    }
    if (parts[0] === "polls" && parts[1] === "results") {
        const periodId = parts[2] || searchParams.get("period") || "current";
        return { page: "poll-results", periodId };
    }
    if (parts[0] === "polls" && parts[1] === "public") {
        const periodId = parts[2] || searchParams.get("period") || "current";
        return { page: "public-poll-results", periodId };
    }
    if (parts[0] === "admin" && parts[1] === "polls") return { page: "admin-polls" };
    if (parts[0] === "admin" && parts[1] === "coaches") return { page: "admin-coaches" };
    if (parts[0] === "admin" && parts[1] === "participation") {
        const periodId = parts[2] || searchParams.get("period") || "current";
        return { page: "admin-participation", periodId };
    }
    if (["spi", "enter-results", "polls", "admin", "sign-in", "set-password"].includes(parts[0])) return { page: parts[0] as Extract<Route, { page: string }>["page"] } as Route;
    return { page: "spi" };
}
