revoke select (season_id, program_id, weapon, spi)
on public.spi_results
from anon;

create or replace view public.public_spi_standings
with (security_invoker = false)
as
select
    season.slug as season_slug,
    program.legacy_team_id as team_id,
    school.name as team_name,
    program.gender,
    result.weapon,
    result.spi
from public.spi_results result
join public.seasons season on season.id = result.season_id
join public.programs program on program.id = result.program_id
join public.schools school on school.id = program.school_id;

comment on view public.public_spi_standings is
    'Public projection of SPI standings. Calculation details and power ratings remain private.';

grant select on public.public_spi_standings to anon, authenticated;
