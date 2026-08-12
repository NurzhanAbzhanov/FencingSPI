import { Plus } from 'lucide-react';
import type { PollCandidate } from '../../types/polls';
import SchoolLogo from '../SchoolLogo';
import { formatDivision } from '../../lib/standingsPresentation';

export default function PollSpiReference({ candidates, seasonSlug, onRank, rankedTeamIds }: {
    candidates: PollCandidate[];
    seasonSlug: string;
    onRank: (teamId: number) => void;
    rankedTeamIds: number[];
}) {
    return <section className="poll-reference" aria-labelledby="spi-reference-title">
        <div className="poll-subheading"><h2 id="spi-reference-title">Calculated SPI snapshot</h2><span>{candidates.length} eligible programs</span></div>
        <div className="platform-table-wrap"><table className="platform-table poll-reference-table"><thead><tr>
            <th>SPI rank</th><th aria-label="Logo" /><th>School</th><th>Division</th><th>Conference</th><th>Region</th><th>SPI</th><th>PR</th><th>Results</th><th aria-label="Rank school" />
        </tr></thead><tbody>{candidates.map((candidate) => {
            const program = { id: candidate.teamId, name: candidate.teamName, gender: 'Men' as const, division: String(candidate.division), conference: candidate.conference, region: candidate.region, logoUrl: candidate.logoUrl };
            return <tr key={candidate.teamId}><td className="numeric">{candidate.spiRank}</td><td><SchoolLogo program={program} size="small" /></td><td className="school-cell">{candidate.teamName}</td><td>{formatDivision(String(candidate.division))}</td><td>{candidate.conference}</td><td>{candidate.region}</td><td className="numeric spi-cell">{candidate.spi.toFixed(4)}</td><td className="numeric">{candidate.powerRating ?? '—'}</td><td><a href={`#/schools/${candidate.teamId}/results?season=${seasonSlug}`}>View</a></td><td><button className="icon-button" type="button" title={`Rank ${candidate.teamName}`} aria-label={`Rank ${candidate.teamName}`} disabled={rankedTeamIds.includes(candidate.teamId)} onClick={() => onRank(candidate.teamId)}><Plus size={17} /></button></td></tr>;
        })}</tbody></table></div>
    </section>;
}
