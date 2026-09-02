begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_view(
    'public',
    'public_spi_standings',
    'public standings view exists'
);

set local role anon;

select is(
    (
        select count(*)::integer
        from public.public_spi_standings
        where season_slug in ('2024-25', '2023-24', '2022-23', '2021-22')
    ),
    558,
    'anonymous visitors can read all published historical standings'
);

reset role;

select results_eq(
    $$
        select season.slug, count(*)::integer
        from public.matches match
        join public.seasons season on season.id = match.season_id
        where season.slug = '2024-25'
        group by season.slug
    $$,
    $$
        values ('2024-25'::text, 1170)
    $$,
    'all valid 2024-25 matches are imported once'
);

select results_eq(
    $$
        select result.weapon::text, count(*)::integer
        from public.spi_results result
        join public.seasons season on season.id = result.season_id
        where season.slug = '2024-25'
        group by result.weapon
        order by result.weapon::text
    $$,
    $$
        values
            ('Epee'::text, 81),
            ('Foil'::text, 81),
            ('Sabre'::text, 81),
            ('Team'::text, 81)
    $$,
    '2024-25 has Team and all three Squad SPI results for every program'
);

select results_eq(
    $$
        select season.slug, count(*)::integer
        from public.spi_results result
        join public.seasons season on season.id = result.season_id
        where season.slug in ('2023-24', '2022-23', '2021-22')
          and result.weapon = 'Team'
        group by season.slug
        order by season.slug desc
    $$,
    $$
        values
            ('2023-24'::text, 79),
            ('2022-23'::text, 78),
            ('2021-22'::text, 77)
    $$,
    'published Team SPI values are imported for the three earlier seasons'
);

select is(
    (
        select count(*)::integer
        from public.spi_results result
        join public.seasons season on season.id = result.season_id
        where season.slug in ('2023-24', '2022-23', '2021-22')
          and result.weapon <> 'Team'
    ),
    0,
    'earlier seasons do not invent unavailable Squad SPI values'
);

select is(
    (
        select count(*)::integer
        from public.spi_results result
        join public.seasons season on season.id = result.season_id
        where season.slug = '2024-25'
          and result.calculation_method = 'calculated'
          and result.source_file = 'Team SPI 2025227 dynamic_1238522923 (1).xlsx'
    ),
    324,
    'recalculated 2024-25 rows retain calculation provenance'
);

select is(
    (
        select round(result.spi, 2)
        from public.spi_results result
        join public.seasons season on season.id = result.season_id
        join public.programs program on program.id = result.program_id
        where season.slug = '2024-25'
          and program.legacy_team_id = 90
          and result.weapon = 'Team'
    ),
    12.88::numeric,
    'Wheaton Men uses the standard five-percent PR credit'
);

select * from finish();
rollback;
