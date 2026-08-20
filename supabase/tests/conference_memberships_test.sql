begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_table('public', 'program_season_conferences', 'program conference memberships table exists');

select results_eq(
    $$
        select membership.conference
        from public.program_season_conferences membership
        join public.program_seasons program_season on program_season.id = membership.program_season_id
        join public.programs program on program.id = program_season.program_id
        join public.schools school on school.id = program.school_id
        join public.seasons season on season.id = program_season.season_id
        where season.slug = '2025-26'
          and school.name = 'Boston College'
          and program.gender = 'Men'
        order by membership.conference
    $$,
    $$values ('ACC'::text), ('NEIFC'::text)$$,
    'Boston College men retain both workbook conference memberships'
);

select results_eq(
    $$
        select membership.conference
        from public.program_season_conferences membership
        join public.program_seasons program_season on program_season.id = membership.program_season_id
        join public.programs program on program.id = program_season.program_id
        join public.schools school on school.id = program.school_id
        join public.seasons season on season.id = program_season.season_id
        where season.slug = '2025-26'
          and school.name = 'Drew University'
          and program.gender = 'Women'
        order by membership.conference
    $$,
    $$values ('EWFC'::text), ('MACFA'::text), ('NIWFA'::text)$$,
    'Drew women receive both women-only memberships plus MACFA'
);

select is(
    (
        select count(*)::integer
        from public.program_season_conferences membership
        join public.program_seasons program_season on program_season.id = membership.program_season_id
        join public.programs program on program.id = program_season.program_id
        where program.gender = 'Men'
          and membership.conference in ('EWFC', 'NIWFA')
    ),
    0,
    'women-only conference memberships are never assigned to men'
);

select ok(
    has_table_privilege('anon', 'public.program_season_conferences', 'SELECT'),
    'conference memberships are public reference data'
);

select * from finish();
rollback;
