create table public.program_season_conferences (
    program_season_id uuid not null references public.program_seasons(id) on delete cascade,
    conference text not null check (btrim(conference) <> ''),
    primary key (program_season_id, conference)
);

alter table public.program_season_conferences enable row level security;

create policy "Public program conference memberships"
on public.program_season_conferences for select
using (true);

create policy "Admins manage program conference memberships"
on public.program_season_conferences for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

grant select on public.program_season_conferences to anon, authenticated;
grant insert, update, delete on public.program_season_conferences to authenticated;

create or replace function public.sync_program_conference_memberships(target_season_slug text)
returns void
language plpgsql
set search_path = public
as $$
begin
delete from public.program_season_conferences membership
using public.program_seasons program_season, public.seasons season
where membership.program_season_id = program_season.id
  and season.id = program_season.season_id
  and season.slug = target_season_slug;

with conference_membership(school_name, conference, women_only) as (values
    ('University of California, San Diego', 'MPSF', false),
    ('University of the Incarnate Word', 'MPSF', false),
    ('U.S. Air Force Academy', 'MPSF', false),
    ('Boston College', 'ACC', false),
    ('Stanford University', 'ACC', false),
    ('University of Notre Dame', 'ACC', false),
    ('University of North Carolina, Chapel Hill', 'ACC', false),
    ('Duke University', 'ACC', false),
    ('Brown University', 'Ivy League', false),
    ('Cornell University', 'Ivy League', false),
    ('Columbia University-Barnard College', 'Ivy League', false),
    ('Princeton University', 'Ivy League', false),
    ('University of Pennsylvania', 'Ivy League', false),
    ('Harvard University', 'Ivy League', false),
    ('Yale University', 'Ivy League', false),
    ('Northwestern University', 'CCFC', false),
    ('The Ohio State University', 'CCFC', false),
    ('Denison University', 'CCFC', false),
    ('Wayne State University (Michigan)', 'CCFC', false),
    ('University of Detroit Mercy', 'CCFC', false),
    ('Cleveland State University', 'CCFC', false),
    ('Lawrence University', 'CCFC', false),
    ('Johns Hopkins University', 'MACFA', false),
    ('Drew University', 'MACFA', false),
    ('Stevens Institute of Technology', 'MACFA', false),
    ('Hunter College', 'MACFA', false),
    ('Yeshiva University', 'MACFA', false),
    ('Haverford College', 'MACFA', false),
    ('Lafayette College', 'MACFA', false),
    ('Boston College', 'NEIFC', false),
    ('Brandeis University', 'NEIFC', false),
    ('Brown University', 'NEIFC', false),
    ('Massachusetts Institute of Technology', 'NEIFC', false),
    ('Sacred Heart University', 'NEIFC', false),
    ('Tufts University', 'NEIFC', false),
    ('Vassar College', 'NEIFC', false),
    ('Wellesley College', 'NEIFC', false),
    ('The City College of New York', 'EWFC', true),
    ('Drew University', 'EWFC', true),
    ('Haverford College', 'EWFC', true),
    ('Yeshiva University', 'EWFC', true),
    ('Hunter College', 'EWFC', true),
    ('Johns Hopkins University', 'EWFC', true),
    ('Stevens Institute of Technology', 'EWFC', true),
    ('Vassar College', 'EWFC', true),
    ('The City College of New York', 'NIWFA', true),
    ('Drew University', 'NIWFA', true),
    ('Haverford College', 'NIWFA', true),
    ('Yeshiva University', 'NIWFA', true),
    ('Hunter College', 'NIWFA', true),
    ('Stevens Institute of Technology', 'NIWFA', true),
    ('Temple University', 'NIWFA', true),
    ('Lafayette College', 'NIWFA', true),
    ('Fairleigh Dickinson University, Metropolitan Campus', 'NIWFA', true)
)
insert into public.program_season_conferences (program_season_id, conference)
select program_season.id, membership.conference
from conference_membership membership
join public.schools school on school.name = membership.school_name
join public.programs program on program.school_id = school.id
join public.program_seasons program_season on program_season.program_id = program.id
join public.seasons season on season.id = program_season.season_id
where season.slug = target_season_slug
  and (not membership.women_only or program.gender = 'Women')
on conflict (program_season_id, conference) do nothing;

update public.program_seasons program_season
set conference = (
    select membership.conference
    from public.program_season_conferences membership
    where membership.program_season_id = program_season.id
    order by case membership.conference
        when 'MPSF' then 1
        when 'ACC' then 1
        when 'Ivy League' then 1
        when 'CCFC' then 1
        when 'MACFA' then 1
        when 'NEIFC' then 2
        when 'EWFC' then 3
        when 'NIWFA' then 4
        else 5
    end,
    membership.conference
    limit 1
)
where exists (
    select 1
    from public.seasons season
    where season.id = program_season.season_id
      and season.slug = target_season_slug
)
and exists (
    select 1
    from public.program_season_conferences membership
    where membership.program_season_id = program_season.id
);

update public.schools school
set conference = program_season.conference
from public.programs program
join public.program_seasons program_season on program_season.program_id = program.id
join public.seasons season on season.id = program_season.season_id
where program.school_id = school.id
  and season.slug = target_season_slug;
end;
$$;

select public.sync_program_conference_memberships('2025-26');

revoke execute on function public.sync_program_conference_memberships(text)
from public, anon, authenticated;
