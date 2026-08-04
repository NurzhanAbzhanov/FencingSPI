import { useEffect, useState } from "react";
import Header from "./components/Header";
import { loadMatches, loadPollResults, loadPrograms, loadStandings, readDemoUser, readLocalPrograms, signOutDemo } from "./lib/platformData";
import { readMatchSubmissions, saveMatchSubmissions } from "./lib/matchResultsStore";
import { supabase } from "./lib/supabase";
import { TEAMS } from "./lib/teams";
import AdminPage from "./pages/AdminPage";
import BallotPage from "./pages/BallotPage";
import PollsPage from "./pages/PollsPage";
import PowerRatingsPage from "./pages/PowerRatingsPage";
import ResultsEntryPage from "./pages/ResultsEntryPage";
import SchoolResultsPage from "./pages/SchoolResultsPage";
import SignInPage from "./pages/SignInPage";
import StandingsPage from "./pages/StandingsPage";
import TransparencyPage from "./pages/TransparencyPage";
import type { PlatformUser, PollResult, Program, SeasonMatch, Standing } from "./types/platform";
import type { Gender, MatchSubmission, Weapon } from "./types/types";
import "./App.css";

type Route =
    | { page: "team-spi" | "squad-spi" | "enter-results" | "power-ratings" | "polls" | "admin" | "sign-in" }
    | { page: "school-results"; teamId: number; season: string }
    | { page: "ballot"; month: string; gender: Gender; weapon: Weapon }
    | { page: "transparency"; label: string };

export default function App() {
    const [route, setRoute] = useState<Route>(getRouteFromHash);
    const [season, setSeason] = useState("2025-26");
    const [programs, setPrograms] = useState<Program[]>([]);
    const [matches, setMatches] = useState<SeasonMatch[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [pollResults, setPollResults] = useState<PollResult[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [user, setUser] = useState<PlatformUser | null>(readDemoUser);
    const [matchSubmissions, setMatchSubmissions] = useState<MatchSubmission[]>(readMatchSubmissions);

    useEffect(() => {
        const onHashChange = () => setRoute(getRouteFromHash());
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
        let active = true;
        Promise.all([loadPrograms(season), loadMatches(season), loadStandings(season), loadPollResults(season)])
            .then(([loadedPrograms, loadedMatches, loadedStandings, loadedPollResults]) => {
                if (!active) return;
                setPrograms([...loadedPrograms, ...readLocalPrograms().filter((local) => !loadedPrograms.some((item) => item.id === local.id))]);
                setMatches(loadedMatches); setStandings(loadedStandings); setPollResults(loadedPollResults); setStatus("ready");
            }).catch(() => active && setStatus("error"));
        return () => { active = false; };
    }, [season]);

    useEffect(() => {
        if (!supabase || user) return;
        const client = supabase;
        client.auth.getUser().then(async ({ data }) => {
            if (!data.user) return;
            const profile = await client.from("profiles").select("display_name, role").eq("id", data.user.id).single();
            if (profile.data) setUser({ id: data.user.id, name: profile.data.display_name, role: profile.data.role });
        });
    }, [user]);

    function changeSeason(nextSeason: string) { setStatus("loading"); setSeason(nextSeason); }
    function handleMatchSubmissionsChange(rows: MatchSubmission[]) { setMatchSubmissions(rows); saveMatchSubmissions(rows); }
    async function signOut() { signOutDemo(); if (supabase) await supabase.auth.signOut(); setUser(null); window.location.hash = "#/team-spi"; }

    const protectedPage = route.page === "polls" || route.page === "ballot" || route.page === "transparency" || route.page === "admin" || route.page === "power-ratings";
    return <><Header activePage={route.page} user={user} onSignOut={signOut} /><main className="app-shell">
        {status === "loading" && !["enter-results", "sign-in"].includes(route.page) ? <div className="page-loading">Loading season data</div> :
        status === "error" && !["enter-results", "sign-in"].includes(route.page) ? <div className="empty-state"><h1>Season data unavailable</h1><p>Refresh the page or choose the active 2025-26 season.</p></div> :
        protectedPage && !user ? <SignInPage onSignedIn={setUser} /> :
        route.page === "team-spi" ? <StandingsPage mode="Team" programs={programs} standings={standings} pollResults={pollResults} season={season} onSeasonChange={changeSeason} /> :
        route.page === "squad-spi" ? <StandingsPage mode="Squad" programs={programs} standings={standings} pollResults={pollResults} season={season} onSeasonChange={changeSeason} /> :
        route.page === "school-results" ? <SchoolResultsPage teamId={route.teamId} season={route.season} programs={programs} matches={matches} /> :
        route.page === "enter-results" ? <ResultsEntryPage submissions={matchSubmissions} teams={TEAMS} onSubmissionsChange={handleMatchSubmissionsChange} /> :
        route.page === "power-ratings" && user ? <PowerRatingsPage programs={programs} season={season} user={user} /> :
        route.page === "sign-in" ? <SignInPage onSignedIn={(signedIn) => { setUser(signedIn); window.location.hash = "#/polls"; }} /> :
        route.page === "polls" && user ? <PollsPage programs={programs} user={user} /> :
        route.page === "ballot" && user ? <BallotPage month={route.month} gender={route.gender} weapon={route.weapon} programs={programs} standings={standings} user={user} /> :
        route.page === "transparency" ? <TransparencyPage label={route.label} /> :
        route.page === "admin" && user ? <AdminPage user={user} programs={programs} onProgramAdded={(program) => setPrograms((current) => [...current, program])} /> : null}
    </main></>;
}

function getRouteFromHash(): Route {
    const raw = window.location.hash.replace(/^#\/?/, ""); const [path, query = ""] = raw.split("?"); const parts = path.split("/").filter(Boolean);
    if (parts[0] === "schools" && parts[2] === "results") return { page: "school-results", teamId: Number(parts[1]), season: new URLSearchParams(query).get("season") ?? "2025-26" };
    if (parts[0] === "polls" && parts[1] === "vote") return { page: "ballot", month: parts[2], gender: parts[3] as Gender, weapon: parts[4] as Weapon };
    if (parts[0] === "polls" && parts[1] === "transparency") return { page: "transparency", label: parts.slice(2).join(" · ") };
    if (["enter-results", "team-spi", "squad-spi", "power-ratings", "polls", "admin", "sign-in"].includes(parts[0])) return { page: parts[0] as Extract<Route, { page: string }>["page"] } as Route;
    return { page: "team-spi" };
}
