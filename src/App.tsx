import { useEffect, useState } from "react";
import Header from "./components/Header";
import { getRouteFromHash, type Route } from "./lib/appRoute";
import { loadMatches, loadPollResults, loadPrograms, loadStandings, readDemoUser, readLocalPrograms, signOutDemo } from "./lib/platformData";
import { readMatchSubmissions, saveMatchSubmissions } from "./lib/matchResultsStore";
import { deleteDatabaseMatchSubmission, loadDatabaseMatchSubmissions, saveDatabaseMatchSubmission } from "./lib/matchRepository";
import { isInitialPasswordSetup, supabase } from "./lib/supabase";
import { TEAMS } from "./lib/teams";
import AdminPage from "./pages/AdminPage";
import BallotPage from "./pages/BallotPage";
import PollsPage from "./pages/PollsPage";
import ResultsEntryPage from "./pages/ResultsEntryPage";
import SchoolResultsPage from "./pages/SchoolResultsPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import SignInPage from "./pages/SignInPage";
import StandingsPage from "./pages/StandingsPage";
import TransparencyPage from "./pages/TransparencyPage";
import type { PlatformUser, PollResult, Program, SeasonMatch, Standing } from "./types/platform";
import type { MatchSubmission } from "./types/types";
import "./App.css";

export default function App() {
    const [route, setRoute] = useState<Route>(() => isInitialPasswordSetup ? { page: "set-password" } : getRouteFromHash());
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
            const profile = await client.from("profiles").select("display_name, role, can_vote").eq("id", data.user.id).single();
            if (profile.data) setUser({ id: data.user.id, name: profile.data.display_name, role: profile.data.role, canVote: profile.data.can_vote });
        });
    }, [user]);

    useEffect(() => {
        if (user?.role !== "admin") return;
        let active = true;
        loadDatabaseMatchSubmissions(season)
            .then((rows) => {
                if (!active || rows === null) return;
                setMatchSubmissions(rows);
                saveMatchSubmissions(rows);
            })
            .catch(() => undefined);
        return () => { active = false; };
    }, [season, user?.id, user?.role]);

    function changeSeason(nextSeason: string) { setStatus("loading"); setSeason(nextSeason); }
    async function handleMatchSave(submission: MatchSubmission) {
        await saveDatabaseMatchSubmission(season, submission);
        setMatchSubmissions((current) => {
            const rows = current.some((row) => row.id === submission.id)
                ? current.map((row) => row.id === submission.id ? submission : row)
                : [...current, submission];
            saveMatchSubmissions(rows);
            return rows;
        });
    }
    async function handleMatchDelete(submission: MatchSubmission) {
        await deleteDatabaseMatchSubmission(season, submission.id);
        setMatchSubmissions((current) => {
            const rows = current.filter((row) => row.id !== submission.id);
            saveMatchSubmissions(rows);
            return rows;
        });
    }
    async function signOut() { signOutDemo(); if (supabase) await supabase.auth.signOut(); setUser(null); window.location.hash = "#/spi"; }

    const protectedPage = route.page === "enter-results" || route.page === "polls" || route.page === "ballot" || route.page === "transparency" || route.page === "admin";
    return <><Header activePage={route.page} user={user} onSignOut={signOut} /><main className="app-shell">
        {status === "loading" && !["enter-results", "sign-in", "set-password"].includes(route.page) ? <div className="page-loading">Loading season data</div> :
        status === "error" && !["enter-results", "sign-in", "set-password"].includes(route.page) ? <div className="empty-state"><h1>Season data unavailable</h1><p>Refresh the page or choose the active 2025-26 season.</p></div> :
        protectedPage && !user ? <SignInPage onSignedIn={setUser} /> :
        route.page === "spi" ? <StandingsPage key={route.initialWeapon ?? "Team"} initialWeapon={route.initialWeapon} programs={programs} standings={standings} pollResults={pollResults} season={season} onSeasonChange={changeSeason} /> :
        route.page === "school-results" ? <SchoolResultsPage teamId={route.teamId} season={route.season} programs={programs} matches={matches} /> :
        route.page === "enter-results" && user?.role === "admin" ? <ResultsEntryPage submissions={matchSubmissions} teams={TEAMS} onSaveSubmission={handleMatchSave} onDeleteSubmission={handleMatchDelete} /> :
        route.page === "enter-results" ? <AccessDenied title="Admin access required" message="Only administrators can upload or edit match results." /> :
        route.page === "set-password" ? <SetPasswordPage onCompleted={(signedIn) => { setUser(signedIn); window.location.hash = "#/polls"; }} /> :
        route.page === "sign-in" ? <SignInPage onSignedIn={(signedIn) => { setUser(signedIn); window.location.hash = "#/polls"; }} /> :
        route.page === "polls" && user ? <PollsPage programs={programs} user={user} /> :
        route.page === "ballot" && user?.canVote ? <BallotPage month={route.month} gender={route.gender} weapon={route.weapon} programs={programs} standings={standings} matches={matches} pollResults={pollResults} user={user} /> :
        route.page === "ballot" ? <AccessDenied title="Voting access required" message="This administrator is not assigned a coaches poll ballot." /> :
        route.page === "transparency" ? <TransparencyPage month={route.month} gender={route.gender} weapon={route.weapon} programs={programs} /> :
        route.page === "admin" && user ? <AdminPage user={user} programs={programs} season={season} onProgramAdded={(program) => setPrograms((current) => [...current, program])} /> : null}
    </main></>;
}

function AccessDenied({ title, message }: { title: string; message: string }) {
    return <section className="empty-state"><h1>{title}</h1><p>{message}</p></section>;
}
