import { ArrowRight, BarChart3, CalendarClock, CheckCircle2, Circle, Settings, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import PollShell from '../../components/polls/PollShell';
import { loadPollDashboard } from '../../lib/pollRepository';
import type { PollDashboard } from '../../types/polls';
import type { PlatformUser } from '../../types/platform';
import './Polls.css';

export default function PollDashboardPage({ user }: { user: PlatformUser }) {
    const [dashboard, setDashboard] = useState<PollDashboard | null>(null);
    const [error, setError] = useState('');
    useEffect(() => { loadPollDashboard(user.id).then(setDashboard).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load the poll.')); }, [user.id]);

    if (error) return <PollShell title="Coaches Poll"><div className="empty-state"><h2>Poll unavailable</h2><p>{error}</p></div></PollShell>;
    if (!dashboard) return <PollShell title="Coaches Poll"><div className="page-loading">Loading poll</div></PollShell>;
    if (!dashboard.period) return <PollShell title="Coaches Poll"><div className="empty-state"><h2>No poll is scheduled</h2><p>An administrator has not initialized a poll period yet.</p></div></PollShell>;

    const team = dashboard.categories.filter((category) => category.weapon === 'Team');
    const squad = dashboard.categories.filter((category) => category.weapon !== 'Team');
    return <PollShell title={dashboard.period.label} actions={<span className={`poll-status ${dashboard.period.status}`}>{dashboard.period.status}</span>}>
        <div className="poll-period-meta"><span><CalendarClock size={17} />{dashboard.period.effectivelyOpen ? `Closes ${formatDate(dashboard.period.closesAt)}` : dashboard.period.status === 'draft' ? 'Voting has not opened' : 'Voting is closed'}</span>{dashboard.period.status !== 'draft' && <a href={`#/polls/results/${dashboard.period.id}`}><BarChart3 size={17} /> Results</a>}</div>
        <CategorySection title="Team ballots" categories={team} canVote={user.canVote} />
        <CategorySection title="Squad ballots" categories={squad} canVote={user.canVote} />
        {user.role === 'admin' && <section className="poll-admin-links"><h2>Administration</h2><div><AdminLink href="#/admin/polls" icon={<Settings size={18} />} label="Poll management" /><AdminLink href="#/admin/coaches" icon={<Users size={18} />} label="Coaches" /><AdminLink href={`#/admin/participation/${dashboard.period.id}`} icon={<BarChart3 size={18} />} label="Participation" /></div></section>}
    </PollShell>;
}

function CategorySection({ title, categories, canVote }: { title: string; categories: PollDashboard['categories']; canVote: boolean }) {
    return <section className="poll-category-section"><h2>{title}</h2><div className="poll-category-list">{categories.map((category) => <div className="poll-category-row" data-testid="poll-category" key={category.slug}>
        <span className={`ballot-completion ${category.ballotStatus}`}>{category.ballotStatus === 'submitted' ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
        <div><strong>{category.label}</strong><span>{labelStatus(category.ballotStatus)}</span></div>
        {canVote && <a className="button secondary compact" href={`#/polls/vote/${category.slug}`}>{category.ballotStatus === 'not_started' ? 'Vote' : 'Edit'} <ArrowRight size={16} /></a>}
    </div>)}</div></section>;
}

function AdminLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) { return <a href={href}>{icon}<span>{label}</span><ArrowRight size={16} /></a>; }
function labelStatus(value: string) { return value === 'not_started' ? 'Not started' : value[0].toUpperCase() + value.slice(1); }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'when closed by an administrator'; }
