begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_table('public', 'fencer_ratings', 'fencer ratings are preserved by season');
select has_function(
    'public',
    'replace_fencer_ratings_and_recalculate',
    array['text', 'public.fencing_gender', 'jsonb', 'text'],
    'admin recalculation function exists'
);

select ok(
    not has_table_privilege('anon', 'public.fencer_ratings', 'SELECT'),
    'fencer ratings are not public'
);

insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rating-admin@example.com')
on conflict (id) do nothing;

insert into public.profiles (id, display_name, role, active)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rating Admin', 'admin', true)
on conflict (id) do update set role = 'admin', active = true;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

select lives_ok(
    $$
        select public.replace_fencer_ratings_and_recalculate(
            '2025-26',
            'Men'::public.fencing_gender,
            jsonb_build_array(
                jsonb_build_object('team_name', 'Pennsylvania State University', 'weapon', 'Epee', 'power_rating', 100),
                jsonb_build_object('team_name', 'Pennsylvania State University', 'weapon', 'Epee', 'power_rating', 80),
                jsonb_build_object('team_name', 'Pennsylvania State University', 'weapon', 'Foil', 'power_rating', 50)
            ),
            'men-ratings.xlsx'
        )
    $$,
    'an admin can replace ratings and recalculate'
);

reset role;

select is(
    (
        select count(*)::integer
        from public.fencer_ratings rating
        join public.seasons season on season.id = rating.season_id
        join public.programs program on program.id = rating.program_id
        where season.slug = '2025-26'
          and program.legacy_team_id = 26
          and program.gender = 'Men'
    ),
    3,
    'all uploaded source rows are retained'
);

insert into public.power_rating_overrides (
    season_id,
    program_id,
    weapon,
    adjusted_power_rating,
    reason,
    updated_by
)
select season.id, program.id, 'Team', 90, 'Test override', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from public.seasons season
join public.programs program on program.legacy_team_id = 49 and program.gender = 'Men'
where season.slug = '2025-26'
on conflict (season_id, program_id, weapon) do update
set adjusted_power_rating = excluded.adjusted_power_rating,
    reason = excluded.reason,
    updated_by = excluded.updated_by;

select results_eq(
    $$
        select result.weapon::text, result.power_rating
        from public.spi_results result
        join public.seasons season on season.id = result.season_id
        join public.programs program on program.id = result.program_id
        where season.slug = '2025-26'
          and program.legacy_team_id = 26
          and program.gender = 'Men'
        order by result.weapon::text
    $$,
    $$values
        ('Epee'::text, 60::numeric),
        ('Foil'::text, 10::numeric),
        ('Sabre'::text, 0::numeric),
        ('Team'::text, 20::numeric)
    $$,
    'partial and missing squads match the validated top-three formula'
);

select is(
    (
        select result.power_rating
        from public.spi_results result
        join public.seasons season on season.id = result.season_id
        join public.programs program on program.id = result.program_id
        join public.schools school on school.id = program.school_id
        where season.slug = '2025-26'
          and school.name = 'Denison University'
          and program.gender = 'Men'
          and result.weapon = 'Epee'
    ),
    0::numeric,
    'an active program absent from the upload receives a zero rating'
);

select is(
    (
        select override.adjusted_power_rating
        from public.power_rating_overrides override
        join public.seasons season on season.id = override.season_id
        join public.programs program on program.id = override.program_id
        where season.slug = '2025-26'
          and program.legacy_team_id = 49
          and program.gender = 'Men'
          and override.weapon = 'Team'
    ),
    90::numeric,
    'recalculation does not change manual overrides'
);

select lives_ok(
    $$
        select public.replace_fencer_ratings_and_recalculate(
            '2025-26',
            'Women'::public.fencing_gender,
            jsonb_build_array(
                jsonb_build_object('team_name', 'Boston College', 'weapon', 'Foil', 'power_rating', 80),
                jsonb_build_object('team_name', 'Boston College', 'weapon', 'Foil', 'power_rating', 70)
            ),
            'women-ratings.xlsx'
        )
    $$,
    'incomplete squads are accepted and divided by three'
);

select * from finish();
rollback;
