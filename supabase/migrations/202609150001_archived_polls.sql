-- Historical publications are not ballots and must never enter vote aggregation.
create table public.archived_poll_results (
    id bigint generated always as identity primary key,
    season_slug text not null references public.seasons(slug),
    team_id bigint not null references public.programs(legacy_team_id),
    gender public.fencing_gender not null,
    weapon public.fencing_weapon not null default 'Team',
    scope public.poll_scope not null,
    period text not null check (period in ('Preseason', 'Midseason', 'End-season')),
    rank integer not null check (rank > 0),
    points numeric check (points >= 0),
    source_url text not null,
    imported_at timestamptz not null default now(),
    unique (season_slug, team_id, weapon, scope, period)
);
alter table public.archived_poll_results enable row level security;
create policy "Read published archive" on public.archived_poll_results for select to anon, authenticated using (true);
grant select on public.archived_poll_results to anon, authenticated;
revoke insert, update, delete on public.archived_poll_results from anon, authenticated;

insert into public.seasons (slug, name, starts_on, ends_on, is_active)
values ('2026-27', '2026-27', '2026-08-01', '2027-07-31', false)
on conflict (slug) do nothing;

insert into public.poll_periods (season_id, month, label, status)
select s.id, p.month, p.label, 'draft'
from public.seasons s
cross join (values (10, 'October'), (11, 'November'), (12, 'December'), (1, 'January')) p(month, label)
where s.slug = '2026-27'
on conflict (season_id, month) do nothing;

-- Carry forward participation metadata only, never results or power ratings.
insert into public.program_seasons (season_id, program_id, division, conference, region)
select next.id, ps.program_id, ps.division, ps.conference, ps.region
from public.program_seasons ps
join public.seasons previous on previous.id = ps.season_id and previous.slug = '2025-26'
cross join public.seasons next
where next.slug = '2026-27'
on conflict (season_id, program_id) do nothing;

insert into public.program_season_conferences (program_season_id, conference)
select target.id, c.conference
from public.program_season_conferences c
join public.program_seasons original on original.id = c.program_season_id
join public.seasons previous on previous.id = original.season_id and previous.slug = '2025-26'
join public.program_seasons target on target.program_id = original.program_id
join public.seasons next on next.id = target.season_id and next.slug = '2026-27'
on conflict do nothing;
