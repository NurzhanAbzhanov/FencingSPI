// Reproducible import of reviewed published ranks. No vote/SPI recalculation.
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const archive = JSON.parse(await readFile('data/legacy-polls.json', 'utf8'));
const keys = new Set();
const values = [];
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
for (const publication of archive) {
    assert.match(publication.source, /^https:\/\/usfca\.org\/download\//);
    for (const group of publication.groups) {
        for (const [team, rank, points] of group.rows) {
            assert(Number.isInteger(team) && Number.isInteger(rank) && rank > 0);
            assert(points === null || (Number.isFinite(points) && points >= 0));
            const key = [publication.season, publication.period, group.scope, team].join('|');
            assert(!keys.has(key), `Duplicate ${key}`);
            keys.add(key);
            values.push(`(${[publication.season, team, group.gender, 'Team', group.scope, publication.period, rank, points, publication.source].map(v => v === null ? 'null' : typeof v === 'number' ? v : quote(v)).join(', ')})`);
        }
    }
}
const sql = `-- Generated from data/legacy-polls.json by scripts/build-poll-archive-migration.mjs.
-- Preserve published ranks, including ties; NULL means points not published.
insert into public.archived_poll_results (season_slug, team_id, gender, weapon, scope, period, rank, points, source_url)
values\n${values.join(',\n')};
do $$ begin
    if exists (select 1 from public.archived_poll_results r join public.programs p on p.legacy_team_id=r.team_id where r.gender <> p.gender) then
        raise exception 'Archive program gender mismatch';
    end if;
end $$;
`;
await writeFile('supabase/migrations/202609150002_archived_poll_data.sql', sql);
console.log(`${values.length} rows from ${archive.length} publications. ${archive.flatMap(p => p.unresolved ?? []).length} unresolved source rows excluded.`);
