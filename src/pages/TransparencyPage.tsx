import { ArrowLeft, LockOpen } from "lucide-react";

export default function TransparencyPage({ label }: { label: string }) {
    return <section className="page-section"><a className="back-link" href="#/polls"><ArrowLeft size={16} /> Ballots</a><div className="page-title-row"><div><p className="eyebrow">Committee transparency</p><h1>{label} votes</h1></div></div><div className="empty-state"><LockOpen size={24} /><h2>Votes become visible after close</h2><p>When this poll closes, all ten submitted coach ballots will appear here alongside the aggregate points and tied rankings.</p></div></section>;
}
