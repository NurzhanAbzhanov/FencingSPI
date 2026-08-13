import { Check, Plus } from 'lucide-react';
import type { PollCandidate } from '../../types/polls';
import SchoolLogo from '../SchoolLogo';

export default function PollSpiReference({ candidates, onRank, rankedTeamIds }: {
    candidates: PollCandidate[];
    onRank: (teamId: number) => void;
    rankedTeamIds: number[];
}) {
    const nextRank = rankedTeamIds.findIndex((teamId) => teamId === 0) + 1;

    return <section className="poll-reference" aria-labelledby="spi-reference-title">
        <div className="poll-subheading"><h2 id="spi-reference-title">Calculated SPI snapshot</h2><span>{candidates.length} eligible programs</span></div>
        <div className="platform-table-wrap"><table className="platform-table poll-reference-table"><thead><tr>
            <th scope="col" aria-label="SPI Rank">SPI<br />Rank</th><th scope="col">Team</th><th scope="col" aria-label="Current SPI">Current<br />SPI</th><th scope="col" aria-label="Last Season SPI">Last Season<br />SPI</th><th scope="col">Div</th><th scope="col">Action</th>
        </tr></thead><tbody>{candidates.map((candidate) => {
            const program = { id: candidate.teamId, name: candidate.teamName, gender: 'Men' as const, division: String(candidate.division), conference: candidate.conference, region: candidate.region, logoUrl: candidate.logoUrl };
            const ranked = rankedTeamIds.includes(candidate.teamId);
            return <tr key={candidate.teamId}>
                <td className="numeric">#{candidate.spiRank}</td>
                <td className="poll-team-cell"><div className="poll-team-identity"><SchoolLogo program={program} size="small" /><span>{candidate.teamName}</span></div></td>
                <td className="numeric current-spi-cell">{candidate.currentSpi.toFixed(4)}</td>
                <td className="numeric previous-spi-cell" aria-label={candidate.previousSpi == null ? 'No prior-season SPI' : undefined}>{candidate.previousSpi == null ? '—' : candidate.previousSpi.toFixed(4)}</td>
                <td>D{candidate.division}</td>
                <td>
                    {ranked ? <span className="poll-voted-state"><Check size={17} /><span>Voted</span></span> : nextRank ? <button className="poll-rank-action" type="button" aria-label={`Rank ${candidate.teamName} at position ${nextRank}`} onClick={() => onRank(candidate.teamId)}><Plus size={17} /><span>Rank {nextRank}</span></button> : <button className="poll-rank-action" type="button" aria-label={`Ballot full: ${candidate.teamName} cannot be ranked`} disabled><span>Ballot full</span></button>}
                </td>
            </tr>;
        })}</tbody></table></div>
    </section>;
}
