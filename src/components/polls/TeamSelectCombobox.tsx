import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getSchoolLogoUrl } from '../../lib/schoolLogos';

type TeamOption = { teamId: number; teamName: string; logoUrl: string | null };

export default function TeamSelectCombobox({ rankNumber, selectedTeamId, teams, selectedTeamIds, onSelectTeam, disabled = false }: {
    rankNumber: number;
    selectedTeamId: number;
    teams: TeamOption[];
    selectedTeamIds: number[];
    onSelectTeam: (teamId: number) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const root = useRef<HTMLDivElement>(null);
    const selected = teams.find((team) => team.teamId === selectedTeamId);
    const filtered = teams.filter((team) => team.teamName.toLowerCase().includes(search.trim().toLowerCase()));

    useEffect(() => {
        function close(event: MouseEvent) {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    return <div className="team-combobox" ref={root}>
        <button type="button" className="team-combobox-trigger" disabled={disabled} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {selected ? <TeamIdentity team={selected} /> : <span className="muted">Select Rank {rankNumber} team</span>}
            <ChevronDown size={17} aria-hidden="true" />
        </button>
        {open && <div className="team-combobox-menu">
            <label className="team-combobox-search"><Search size={15} /><span className="sr-only">Search teams</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teams" autoFocus /></label>
            <div className="team-combobox-options" role="listbox" aria-label={`Rank ${rankNumber} teams`}>
                {selectedTeamId > 0 && <button type="button" role="option" aria-selected="false" className="team-option clear" onClick={() => { onSelectTeam(0); setOpen(false); setSearch(''); }}><X size={15} /> Clear selection</button>}
                {filtered.map((team) => {
                    const here = team.teamId === selectedTeamId;
                    const elsewhere = selectedTeamIds.includes(team.teamId) && !here;
                    return <button type="button" role="option" aria-selected={here} aria-disabled={elsewhere} disabled={elsewhere} className="team-option" key={team.teamId} onClick={() => { onSelectTeam(team.teamId); setOpen(false); setSearch(''); }}>
                        <TeamIdentity team={team} />
                        {here && <span className="team-option-state">Rank {rankNumber}</span>}
                        {elsewhere && <span className="team-option-state">Selected</span>}
                    </button>;
                })}
                {!filtered.length && <p className="empty-combobox">No matching teams</p>}
            </div>
        </div>}
    </div>;
}

function TeamIdentity({ team }: { team: TeamOption }) {
    const url = getSchoolLogoUrl({ name: team.teamName, logoUrl: team.logoUrl });
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const initials = team.teamName.split(/\s+/).filter((word) => !['of', 'the', 'and'].includes(word.toLowerCase())).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
    return <span className="team-identity">
        {url && failedUrl !== url
            ? <img src={url} alt="" onError={() => setFailedUrl(url)} />
            : <span className="team-identity-fallback">{initials}</span>}
        <span>{team.teamName}</span>
    </span>;
}
