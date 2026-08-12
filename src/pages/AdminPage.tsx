import { LockOpen, Plus, Save, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { POLL_MONTHS } from "../lib/platformData";
import { createProgram, loadCommitteeCounts, loadSubmittedBallots, reopenSubmittedBallot, savePollSchedule } from "../lib/adminRepository";
import type { PlatformUser, Program, SubmittedBallotSummary } from "../types/platform";
import type { Gender } from "../types/types";
import PowerRatingsPage from "./PowerRatingsPage";

export default function AdminPage({ user, programs, season, onProgramAdded }: { user: PlatformUser; programs: Program[]; season: string; onProgramAdded: (program: Program) => void }) {
    const [name, setName] = useState(""); const [gender, setGender] = useState<Gender>("Men"); const [division, setDivision] = useState("3"); const [region, setRegion] = useState("Unassigned"); const [conference, setConference] = useState("Unassigned");
    const [periods, setPeriods] = useState(() => POLL_MONTHS.map((month) => ({ month, status: month === "October" ? "Open" : "Draft" })));
    const [message, setMessage] = useState("");
    const [committee, setCommittee] = useState({ admins: 0, voters: 0 });
    const [submittedBallots, setSubmittedBallots] = useState<SubmittedBallotSummary[]>([]);
    useEffect(() => {
        loadCommitteeCounts().then(setCommittee).catch(() => undefined);
        loadSubmittedBallots().then(setSubmittedBallots).catch(() => undefined);
    }, []);
    if (user.role !== "admin") return <section className="empty-state"><ShieldCheck size={24} /><h1>Admin access required</h1><p>Your coach account can vote and review closed ballots, but cannot change platform data.</p></section>;

    async function addSchool(event: React.FormEvent) {
        event.preventDefault();
        const nextId = Math.max(0, ...programs.map((program) => program.id)) + 1;
        const program: Program = { id: nextId, name: name.trim(), gender, division, region: region.trim() || "Unassigned", conference: conference.trim() || "Unassigned", logoUrl: null };
        try { await createProgram(program); onProgramAdded(program); setName(""); setMessage(`${program.name} was added.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add program."); }
    }

    async function saveSchedule() { try { await savePollSchedule(periods); setMessage("Poll schedule saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save schedule."); } }
    async function reopen(ballot: SubmittedBallotSummary) {
        try {
            await reopenSubmittedBallot(ballot.ballotId);
            setSubmittedBallots((current) => current.filter((item) => item.ballotId !== ballot.ballotId));
            setMessage(`${ballot.voterName}'s ${ballot.month} ${ballot.gender} ${ballot.weapon} ${ballot.scope} ballot was reopened.`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not reopen ballot.");
        }
    }

    return <section className="page-section admin-page"><div className="page-title-row"><div><p className="eyebrow">Platform administration</p><h1>Admin</h1></div><div className="session-user"><ShieldCheck size={16} /> {user.name}</div></div>
        <div className="admin-grid"><section className="admin-section"><h2>Poll schedule</h2><p>Open, close and publish each monthly poll. Closing makes individual ballots visible to the committee.</p><div className="admin-list">{periods.map((period) => <div className="admin-list-row" key={period.month}><strong>{period.month}{period.month === "October" ? " (Preseason)" : ""}</strong><select value={period.status} onChange={(event) => setPeriods((current) => current.map((item) => item.month === period.month ? { ...item, status: event.target.value } : item))}><option>Draft</option><option>Open</option><option>Closed</option><option>Published</option></select></div>)}</div><button className="button secondary" onClick={saveSchedule}><Save size={17} /> Save schedule</button></section>
        <section className="admin-section"><h2>Committee</h2><p>Ten assigned voters submit every ballot. Supabase Auth controls invitations and password recovery.</p><div className="committee-count"><Users size={22} /><strong>{committee.voters} of 10</strong><span>voters assigned · {committee.admins} administrator{committee.admins === 1 ? "" : "s"}</span></div></section></div>
        <section className="admin-section"><h2>Add a school program</h2><form className="school-form" onSubmit={addSchool}><label>School name<input required value={name} onChange={(e) => setName(e.target.value)} /></label><label>Gender<select value={gender} onChange={(e) => setGender(e.target.value as Gender)}><option>Men</option><option>Women</option></select></label><label>Division<select value={division} onChange={(e) => setDivision(e.target.value)}><option value="1">I</option><option value="2">II</option><option value="3">III</option></select></label><label>Region<input value={region} onChange={(e) => setRegion(e.target.value)} /></label><label>Conference<input value={conference} onChange={(e) => setConference(e.target.value)} /></label><button className="button primary"><Plus size={17} /> Add program</button></form><p className="help-line">A text-initial logo is used until a logo URL is added.</p>{message && <p className="form-message">{message}</p>}</section>
        <PowerRatingsPage embedded programs={programs} season={season} user={user} />
        <section className="admin-section"><h2>Submitted ballots</h2><p>Reopening unlocks a submitted ballot for its voter while the poll remains open.</p>{submittedBallots.length === 0 ? <p className="help-line">No submitted ballots are waiting.</p> : <div className="admin-list">{submittedBallots.map((ballot) => <div className="admin-list-row submitted-ballot-row" key={ballot.ballotId}><div><strong>{ballot.voterName}</strong><span>{ballot.month} · {ballot.gender} · {ballot.weapon} · {ballot.scope}</span></div><button className="button secondary" onClick={() => reopen(ballot)}><LockOpen size={16} /> Reopen</button></div>)}</div>}</section>
    </section>;
}
