import type { PollStanding } from '../../types/polls';
import SchoolLogo from '../SchoolLogo';

export default function PollResultsTable({ rows }: { rows: PollStanding[] }) {
    return <div className="platform-table-wrap"><table className="platform-table poll-results-table"><thead><tr><th>Rank</th><th aria-label="Logo" /><th>School</th><th>Points</th><th>First-place votes</th></tr></thead><tbody>
        {rows.length ? rows.map((row) => {
            const program = { id: row.teamId, name: row.teamName, gender: 'Men' as const, division: '1', conference: '', region: '', logoUrl: null };
            return <tr key={row.teamId}><td className="numeric rank-cell">{row.rank}</td><td><SchoolLogo program={program} size="small" /></td><td className="school-cell">{row.teamName}</td><td className="numeric">{row.points}</td><td className="numeric">{row.firstPlaceVotes}</td></tr>;
        }) : <tr><td colSpan={5} className="empty-table">No published votes are available for this category.</td></tr>}
    </tbody></table></div>;
}
