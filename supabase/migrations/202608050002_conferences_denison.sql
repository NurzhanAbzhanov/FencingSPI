insert into public.schools (id, name, logo_url, conference, region)
values (92, 'Denison University', null, 'CCFC', 'Midwest')
on conflict (id) do update
set name = excluded.name,
    conference = excluded.conference,
    region = excluded.region;

insert into public.programs (school_id, legacy_team_id, gender)
values (92, 92, 'Men')
on conflict (legacy_team_id) do update
set school_id = excluded.school_id,
    gender = excluded.gender;

insert into public.program_seasons (season_id, program_id, division, conference, region)
select s.id, p.id, 3, 'CCFC', 'Midwest'
from public.seasons s
join public.programs p on p.legacy_team_id = 92
where s.slug = '2025-26'
on conflict (season_id, program_id) do update
set division = excluded.division,
    conference = excluded.conference,
    region = excluded.region;

update public.schools
set conference = case
    when name in (
        'U.S. Air Force Academy',
        'University of California, San Diego',
        'University of the Incarnate Word'
    ) then 'MPSF'
    when name in (
        'Boston College',
        'University of Notre Dame',
        'Stanford University',
        'University of North Carolina, Chapel Hill',
        'Duke University'
    ) then 'ACC'
    when name in (
        'The Ohio State University',
        'Northwestern University',
        'University of Detroit Mercy',
        'Wayne State University (Michigan)',
        'Lawrence University',
        'Denison University',
        'Cleveland State University'
    ) then 'CCFC'
    else conference
end
where name in (
    'U.S. Air Force Academy',
    'University of California, San Diego',
    'University of the Incarnate Word',
    'Boston College',
    'University of Notre Dame',
    'Stanford University',
    'University of North Carolina, Chapel Hill',
    'Duke University',
    'The Ohio State University',
    'Northwestern University',
    'University of Detroit Mercy',
    'Wayne State University (Michigan)',
    'Lawrence University',
    'Denison University',
    'Cleveland State University'
);

update public.program_seasons ps
set conference = s.conference
from public.programs p
join public.schools s on s.id = p.school_id
where ps.program_id = p.id
  and s.conference <> 'Unassigned';

insert into public.spi_results (season_id, program_id, weapon, spi)
select s.id, p.id, weapon, 0
from public.seasons s
join public.programs p on p.legacy_team_id = 92
cross join unnest(enum_range(null::public.fencing_weapon)) weapon
where s.slug = '2025-26'
on conflict (season_id, program_id, weapon) do update
set spi = excluded.spi,
    calculated_at = now();

update public.ballot_definitions bd
set rank_limit = greatest((
    select count(*)::integer
    from public.program_seasons ps
    join public.programs p on p.id = ps.program_id
    where ps.season_id = pp.season_id
      and ps.division = 3
      and p.gender = bd.gender
), 1)
from public.poll_periods pp
where bd.period_id = pp.id
  and bd.scope = 'DIII';
