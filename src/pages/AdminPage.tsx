import { Plus, Save, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { POLL_MONTHS } from "../lib/platformData";
import { createProgram, loadCommitteeCounts, savePollSchedule } from "../lib/adminRepository";
import type { PlatformUser, Program } from "../types/platform";
import type { Gender } from "../types/types";

export default function AdminPage({ user, programs, onProgramAdded }: { user: PlatformUser; programs: Program[]; onProgramAdded: (program: Program) => void }) {
    const [name, setName] = useState(""); const [gender, setGender] = useState<Gender>("Men"); const [division, setDivision] = useState("3"); const [region, setRegion] = useState("Unassigned"); const [conference, setConference] = useState("Unassigned");
    const [periods, setPeriods] = useState(() => POLL_MONTHS.map((month) => ({ month, status: month === "October" ? "Open" : "Draft" })));
    const [message, setMessage] = useState("");
    const [committee, setCommittee] = useState({ admins: 0, voters: 0 });
    useEffect(() => {
        loadCommitteeCounts().then(setCommittee).catch(() => undefined);
    }, []);
    if (user.role !== "admin") return <section className="empty-state"><ShieldCheck size={24} /><h1>Admin access required</h1><p>Your coach account can vote and review closed ballots, but cannot change platform data.</p></section>;

    async function addSchool(event: React.FormEvent) {
        event.preventDefault();
        const nextId = Math.max(0, ...programs.map((program) => program.id)) + 1;
        const program: Program = { id: nextId, name: name.trim(), gender, division, region: region.trim() || "Unassigned", conference: conference.trim() || "Unassigned", logoUrl: null };
        try { await createProgram(program); onProgramAdded(program); setName(""); setMessage(`${program.name} was added.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add program."); }
    }

    async function saveSchedule() { try { await savePollSchedule(periods); setMessage("Poll schedule saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save schedule."); } }

    return <section className="page-section admin-page"><div className="page-title-row"><div><p className="eyebrow">Platform administration</p><h1>Admin</h1></div><div className="session-user"><ShieldCheck size={16} /> {user.name}</div></div>
        <div className="admin-grid"><section className="admin-section"><h2>Poll schedule</h2><p>Open, close and publish each monthly poll. Closing makes individual ballots visible to the committee.</p><div className="admin-list">{periods.map((period) => <div className="admin-list-row" key={period.month}><strong>{period.month}{period.month === "October" ? " (Preseason)" : ""}</strong><select value={period.status} onChange={(event) => setPeriods((current) => current.map((item) => item.month === period.month ? { ...item, status: event.target.value } : item))}><option>Draft</option><option>Open</option><option>Closed</option><option>Published</option></select></div>)}</div><button className="button secondary" onClick={saveSchedule}><Save size={17} /> Save schedule</button></section>
        <section className="admin-section"><h2>Committee</h2><p>Ten assigned voters submit every ballot. Supabase Auth controls invitations and password recovery.</p><div className="committee-count"><Users size={22} /><strong>{committee.voters} of 10</strong><span>voters assigned · {committee.admins} administrator{committee.admins === 1 ? "" : "s"}</span></div></section></div>
        <section className="admin-section"><h2>Add a school program</h2><form className="school-form" onSubmit={addSchool}><label>School name<input required value={name} onChange={(e) => setName(e.target.value)} /></label><label>Gender<select value={gender} onChange={(e) => setGender(e.target.value as Gender)}><option>Men</option><option>Women</option></select></label><label>Division<select value={division} onChange={(e) => setDivision(e.target.value)}><option value="1">Division I</option><option value="2">Division II</option><option value="3">Division III</option></select></label><label>Region<input value={region} onChange={(e) => setRegion(e.target.value)} /></label><label>Conference<input value={conference} onChange={(e) => setConference(e.target.value)} /></label><button className="button primary"><Plus size={17} /> Add program</button></form><p className="help-line">A text-initial logo is used until a logo URL is added.</p>{message && <p className="form-message">{message}</p>}</section>
    </section>;
}
