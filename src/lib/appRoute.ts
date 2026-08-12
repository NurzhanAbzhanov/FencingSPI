import type { Gender, Weapon } from "../types/types";
import type { StandingsView } from "./standingsPresentation";

export type Route =
    | { page: "spi"; initialMode?: StandingsView }
    | { page: "enter-results" | "power-ratings" | "polls" | "admin" | "sign-in" | "set-password" }
    | { page: "school-results"; teamId: number; season: string }
    | { page: "ballot"; month: string; gender: Gender; weapon: Weapon }
    | { page: "transparency"; month: string; gender: Gender; weapon: Weapon };

export function getRouteFromHash(): Route {
    const raw = window.location.hash.replace(/^#\/?/, "");
    const [path, query = ""] = raw.split("?");
    const parts = path.split("/").filter(Boolean);

    if (parts[0] === "team-spi") return { page: "spi", initialMode: "Team" };
    if (parts[0] === "squad-spi") return { page: "spi", initialMode: "Squad" };
    if (parts[0] === "schools" && parts[2] === "results") return { page: "school-results", teamId: Number(parts[1]), season: new URLSearchParams(query).get("season") ?? "2025-26" };
    if (parts[0] === "polls" && parts[1] === "vote") return { page: "ballot", month: parts[2], gender: parts[3] as Gender, weapon: parts[4] as Weapon };
    if (parts[0] === "polls" && parts[1] === "transparency") return { page: "transparency", month: parts[2], gender: parts[3] as Gender, weapon: parts[4] as Weapon };
    if (["spi", "enter-results", "power-ratings", "polls", "admin", "sign-in", "set-password"].includes(parts[0])) return { page: parts[0] as Extract<Route, { page: string }>["page"] } as Route;
    return { page: "spi" };
}
