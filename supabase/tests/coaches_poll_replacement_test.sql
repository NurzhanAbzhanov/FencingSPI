begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_function('public', 'list_committee_access', array[]::text[], 'committee access listing RPC exists');
select has_function('public', 'list_poll_participation', array['uuid'], 'participation listing RPC exists');

select has_table('public', 'poll_spi_snapshots', 'poll SPI snapshots table exists');
select has_table('public', 'committee_access_grants', 'committee access grants table exists');
select has_table('public', 'poll_admin_audit_log', 'poll administrator audit table exists');
select has_column('public', 'ballot_definitions', 'slug', 'ballot definitions have stable slugs');
select has_column('public', 'ballot_definitions', 'hidden', 'ballot definitions support hidden categories');
select has_column('public', 'ballot_definitions', 'archived_at', 'ballot definitions support archival');

select is(
    (
        select count(*)::integer
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
              'initialize_poll_period',
              'schedule_poll_period',
              'open_poll_period',
              'close_poll_period',
              'save_poll_ballot',
              'publish_poll_period',
              'save_committee_access',
              'create_spi_profile_for_auth_user',
              'poll_is_open',
              'poll_is_closed',
              'sync_existing_committee_access_grants'
          )
          and p.prosecdef
          and p.proconfig @> array['search_path=public']::text[]
    ),
    11,
    'all privileged Task 2 functions pin their search path'
);

insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{"display_name":"Fixture Admin"}'::jsonb, now(), now()),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'voter@example.com', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{"display_name":"Fixture Voter"}'::jsonb, now(), now()),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'voter2@example.com', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{"display_name":"Second Voter"}'::jsonb, now(), now()),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'committee@example.com', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{"display_name":"Committee Member"}'::jsonb, now(), now());

insert into public.profiles (id, display_name, role, can_vote, active)
values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Fixture Admin', 'admin', true, true),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Fixture Voter', 'coach', true, true),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Second Voter', 'coach', true, true),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Committee Member', 'coach', false, true)
on conflict (id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    can_vote = excluded.can_vote,
    active = excluded.active;

select lives_ok(
    $$select public.sync_existing_committee_access_grants()$$,
    'existing profile fixtures can be synchronized through the migration grant path'
);

select is(
    (
        select count(*)
        from public.profiles p
        join auth.users u on u.id = p.id
        left join public.committee_access_grants g on g.email = lower(btrim(u.email))
        where p.id in (
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
        )
          and (
              g.email is null
              or g.display_name <> p.display_name
              or g.role <> p.role
              or g.can_vote <> p.can_vote
              or g.active <> p.active
          )
    ),
    0::bigint,
    'migration grant sync preserves every field from existing profile fixtures'
);

insert into public.seasons (id, slug, name, starts_on, ends_on, is_active)
values
    ('11111111-1111-4111-8111-111111111111', 'task-2-main', 'Task 2 Main', '2026-08-01', '2027-07-31', true),
    ('11111111-1111-4111-8111-111111111112', 'task-2-incomplete', 'Task 2 Incomplete', '2026-08-01', '2027-07-31', false);

insert into public.schools (id, name, short_name, conference, region)
select
    990000 + fixture_number,
    'Test School ' || lpad(fixture_number::text, 2, '0'),
    'TS' || lpad(fixture_number::text, 2, '0'),
    case when fixture_number % 2 = 0 then 'Eastern' else 'Western' end,
    case when fixture_number % 2 = 0 then 'East' else 'West' end
from generate_series(1, 31) fixture_number;

insert into public.programs (id, school_id, legacy_team_id, gender)
select
    md5('task-2-program-' || fixture_number)::uuid,
    990000 + fixture_number,
    990000 + fixture_number,
    case when fixture_number <= 15 or fixture_number = 31 then 'Men'::public.fencing_gender else 'Women'::public.fencing_gender end
from generate_series(1, 31) fixture_number;

insert into public.program_seasons (season_id, program_id, division, conference, region)
select
    '11111111-1111-4111-8111-111111111111',
    p.id,
    case when ((p.legacy_team_id - 990001) % 15) < 8 then 3 else 1 end,
    s.conference,
    s.region
from public.programs p
join public.schools s on s.id = p.school_id
where p.legacy_team_id between 990001 and 990030;

insert into public.program_seasons (season_id, program_id, division, conference, region)
select
    '11111111-1111-4111-8111-111111111112',
    p.id,
    3,
    s.conference,
    s.region
from public.programs p
join public.schools s on s.id = p.school_id
where p.legacy_team_id = 990031;

insert into public.spi_results (season_id, program_id, weapon, spi, power_rating)
select
    '11111111-1111-4111-8111-111111111111',
    p.id,
    weapon,
    1000 - (p.legacy_team_id - 990000) + case weapon
        when 'Team'::public.fencing_weapon then 40
        when 'Epee'::public.fencing_weapon then 30
        when 'Foil'::public.fencing_weapon then 20
        when 'Sabre'::public.fencing_weapon then 10
    end,
    100 - (p.legacy_team_id - 990000)
from public.programs p
cross join unnest(enum_range(null::public.fencing_weapon)) as weapon_values(weapon)
where p.legacy_team_id between 990001 and 990030;

insert into public.spi_results (season_id, program_id, weapon, spi, power_rating)
select
    '11111111-1111-4111-8111-111111111112',
    p.id,
    weapon,
    500,
    50
from public.programs p
cross join unnest(array['Team', 'Epee', 'Foil']::public.fencing_weapon[]) as weapon_values(weapon)
where p.legacy_team_id = 990031;

insert into public.matches (
    source_id,
    season_id,
    fenced_on,
    gender,
    left_program_id,
    right_program_id,
    left_sabre,
    left_foil,
    left_epee,
    right_sabre,
    right_foil,
    right_epee,
    host,
    submitted_by,
    submission_email
)
values (
    990001,
    '11111111-1111-4111-8111-111111111111',
    '2026-08-10',
    'Men',
    md5('task-2-program-1')::uuid,
    md5('task-2-program-2')::uuid,
    9,
    9,
    9,
    6,
    6,
    5,
    'Task 2 Invitational',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'private@example.com'
);

insert into public.poll_periods (id, season_id, month, label, status)
values
    ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 10, 'Task 2 Primary', 'draft'),
    ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111112', 10, 'Task 2 Incomplete', 'draft'),
    ('22222222-2222-4222-8222-222222222223', '11111111-1111-4111-8111-111111111111', 11, 'Task 2 Other', 'draft');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

select throws_ok(
    $$select public.initialize_poll_period('22222222-2222-4222-8222-222222222221')$$,
    'Administrator access required',
    'non-administrators cannot initialize poll periods'
);

select throws_ok(
    $$select public.schedule_poll_period('22222222-2222-4222-8222-222222222221', now(), now() - interval '1 hour')$$,
    'Administrator access required',
    'non-administrators cannot schedule poll periods'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

select throws_ok(
    $$select public.schedule_poll_period('22222222-2222-4222-8222-222222222221', now() + interval '2 hours', now() + interval '1 hour')$$,
    'Poll opening time must precede its closing time',
    'scheduling rejects an inverted time range'
);

select lives_ok(
    $$select public.schedule_poll_period('22222222-2222-4222-8222-222222222221', now() - interval '1 hour', now() + interval '1 day')$$,
    'an administrator can schedule a draft period'
);

select lives_ok(
    $$select public.initialize_poll_period('22222222-2222-4222-8222-222222222221')$$,
    'an administrator can initialize a draft period'
);

select is(
    (select count(*)::integer from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221'),
    16,
    'initialization creates all supplied categories'
);

select is(
    (select count(*)::integer from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and hidden = false),
    10,
    'only ten supplied categories are visible'
);

select is(
    (
        select jsonb_object_agg(slug, rank_limit order by slug)
        from public.ballot_definitions
        where period_id = '22222222-2222-4222-8222-222222222221'
    ),
    '{"men_squad_epee_diii":5,"men_squad_epee_overall":15,"men_squad_foil_diii":5,"men_squad_foil_overall":15,"men_squad_sabre_diii":5,"men_squad_sabre_overall":15,"men_team_diii":8,"men_team_overall":15,"women_squad_epee_diii":5,"women_squad_epee_overall":15,"women_squad_foil_diii":5,"women_squad_foil_overall":15,"women_squad_sabre_diii":5,"women_squad_sabre_overall":15,"women_team_diii":8,"women_team_overall":15}'::jsonb,
    'initialization uses the authoritative fixed slot counts'
);

select is(
    (
        select array_agg(slug order by slug)
        from public.ballot_definitions
        where period_id = '22222222-2222-4222-8222-222222222221'
          and hidden
    ),
    array[
        'men_squad_epee_diii',
        'men_squad_foil_diii',
        'men_squad_sabre_diii',
        'women_squad_epee_diii',
        'women_squad_foil_diii',
        'women_squad_sabre_diii'
    ],
    'only the six Division III weapon slugs are hidden'
);

select set_config(
    'tests.hidden_definition',
    (
        select id::text
        from public.ballot_definitions
        where period_id = '22222222-2222-4222-8222-222222222221'
          and slug = 'men_squad_epee_diii'
    ),
    true
);

select lives_ok(
    $$select public.initialize_poll_period('22222222-2222-4222-8222-222222222222')$$,
    'the incomplete fixture can be initialized'
);

select throws_ok(
    $$select public.open_poll_period('22222222-2222-4222-8222-222222222222')$$,
    'Calculated SPI snapshot is incomplete',
    'opening rejects incomplete calculated SPI'
);

select lives_ok(
    $$select public.open_poll_period('22222222-2222-4222-8222-222222222221')$$,
    'an administrator can open a complete poll period'
);

select throws_ok(
    $$select public.schedule_poll_period('22222222-2222-4222-8222-222222222221', now(), now() + interval '1 day')$$,
    'Only draft poll periods can be scheduled',
    'scheduling rejects a period after it leaves draft'
);

select is(
    (select count(*)::integer from public.poll_spi_snapshots where period_id = '22222222-2222-4222-8222-222222222221'),
    120,
    'opening snapshots all four SPI values for every active program'
);

select is(
    (
        select max(spi_rank)
        from public.poll_spi_snapshots
        where period_id = '22222222-2222-4222-8222-222222222221'
          and gender = 'Men'
          and weapon = 'Team'
    ),
    15,
    'snapshot SPI ranks are partitioned by gender and weapon'
);

reset role;
update public.spi_results
set spi = 1
where season_id = '11111111-1111-4111-8111-111111111111'
  and program_id = md5('task-2-program-1')::uuid
  and weapon = 'Team';

update public.program_seasons
set division = case
    when program_id = md5('task-2-program-8')::uuid then 1
    else 3
end
where season_id = '11111111-1111-4111-8111-111111111111'
  and program_id in (
      md5('task-2-program-8')::uuid,
      md5('task-2-program-9')::uuid
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select is(
    (
        select spi
        from public.poll_spi_snapshots
        where period_id = '22222222-2222-4222-8222-222222222221'
          and program_id = md5('task-2-program-1')::uuid
          and weapon = 'Team'
    ),
    1039::numeric,
    'source SPI changes do not mutate an opened snapshot'
);

select throws_ok(
    $$select public.open_poll_period('22222222-2222-4222-8222-222222222223')$$,
    'Another poll period is already open',
    'only one poll period can be effectively open'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

select throws_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_overall'),
            (select array_agg(id order by legacy_team_id) from public.programs where legacy_team_id between 990001 and 990014),
            false
        )
    $$,
    'Ballot requires exactly 15 ranked programs',
    'ballots must fill every supplied slot'
);

select throws_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_overall'),
            array_fill(md5('task-2-program-1')::uuid, array[15]),
            false
        )
    $$,
    'Ballot rankings must be unique',
    'ballot rankings cannot contain duplicates'
);

select throws_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_overall'),
            (select array_agg(id order by legacy_team_id) from public.programs where legacy_team_id between 990016 and 990030),
            false
        )
    $$,
    'Ballot rankings contain ineligible programs',
    'ballot rankings must match the category gender and season'
);

select throws_ok(
    $$
        select public.save_poll_ballot(
            current_setting('tests.hidden_definition')::uuid,
            (select array_agg(id order by legacy_team_id) from public.programs where legacy_team_id between 990001 and 990005),
            false
        )
    $$,
    'This ballot category is not available',
    'hidden Division III weapon categories cannot receive ballots'
);

select throws_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_diii'),
            (select array_agg(p.id order by p.legacy_team_id) from public.programs p where p.legacy_team_id between 990001 and 990008),
            false
        )
    $$,
    'Submit the Team Overall ballot before saving Team Division III',
    'Team Overall submission is a prerequisite for Team Division III'
);

select throws_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_diii'),
            (select array_agg(p.id order by p.legacy_team_id) from public.programs p where p.legacy_team_id between 990001 and 990007 or p.legacy_team_id = 990009),
            false
        )
    $$,
    'Ballot rankings contain ineligible programs',
    'Division III eligibility remains fixed to the opened snapshot'
);

select lives_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_overall'),
            (select array_agg(id order by legacy_team_id) from public.programs where legacy_team_id between 990001 and 990015),
            true
        )
    $$,
    'a voter can submit a complete eligible Team Overall ballot'
);

select throws_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_diii'),
            (select array_agg(p.id order by p.legacy_team_id desc) from public.programs p where p.legacy_team_id between 990001 and 990008),
            true
        )
    $$,
    'Team Division III ballot must preserve the Overall Division III prefix',
    'Team Division III rejects a changed locked prefix'
);

select lives_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_diii'),
            (select array_agg(p.id order by p.legacy_team_id) from public.programs p where p.legacy_team_id between 990001 and 990008),
            true
        )
    $$,
    'a Team Division III ballot accepts the locked Overall prefix'
);

select lives_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_overall'),
            (
                select array_agg(id order by case legacy_team_id when 990001 then 990002 when 990002 then 990001 else legacy_team_id end)
                from public.programs
                where legacy_team_id between 990001 and 990015
            ),
            true
        )
    $$,
    'a submitted ballot remains editable while the poll is open'
);

select is(
    (
        select b.status
        from public.ballots b
        join public.ballot_definitions d on d.id = b.definition_id
        where b.voter_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
          and d.slug = 'men_team_diii'
    ),
    'draft'::public.ballot_status,
    'changing submitted Team Overall returns matching Team Division III to draft'
);

select lives_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_diii'),
            (
                select array_agg(id order by case legacy_team_id when 990001 then 990002 when 990002 then 990001 else legacy_team_id end)
                from public.programs
                where legacy_team_id between 990001 and 990008
            ),
            true
        )
    $$,
    'the voter can review and resubmit the regenerated Division III prefix'
);

reset role;

delete from public.ballot_rankings
where ballot_id = (
    select b.id
    from public.ballots b
    join public.ballot_definitions d on d.id = b.definition_id
    where b.voter_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and d.slug = 'men_team_diii'
);

with target_ballot as (
    select b.id
    from public.ballots b
    join public.ballot_definitions d on d.id = b.definition_id
    where b.voter_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and d.slug = 'men_team_diii'
)
insert into public.ballot_rankings (ballot_id, program_id, rank)
select
    target_ballot.id,
    p.id,
    row_number() over (order by p.legacy_team_id)
from target_ballot
cross join public.programs p
where p.legacy_team_id between 990001 and 990008;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

select throws_ok(
    $$select public.close_poll_period('22222222-2222-4222-8222-222222222221')$$,
    'Submitted Team Division III ballot does not match its Team Overall prefix',
    'closing revalidates every submitted Team Division III prefix'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select lives_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_diii'),
            (
                select array_agg(id order by case legacy_team_id when 990001 then 990002 when 990002 then 990001 else legacy_team_id end)
                from public.programs
                where legacy_team_id between 990001 and 990008
            ),
            true
        )
    $$,
    'the voter can repair the Division III ballot before close'
);

select lives_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_overall'),
            (select array_agg(id order by legacy_team_id) from public.programs where legacy_team_id between 990001 and 990015),
            true
        )
    $$,
    'the voter can restore the submitted Overall ballot before close'
);

select is(
    (
        select b.status
        from public.ballots b
        join public.ballot_definitions d on d.id = b.definition_id
        where b.voter_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
          and d.slug = 'men_team_diii'
    ),
    'draft'::public.ballot_status,
    'a second Overall change again invalidates the submitted Division III ballot'
);

select lives_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_diii'),
            (select array_agg(id order by legacy_team_id) from public.programs where legacy_team_id between 990001 and 990008),
            true
        )
    $$,
    'the restored Overall prefix can be resubmitted for Division III'
);

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
select lives_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_overall'),
            (select array_agg(id order by legacy_team_id desc) from public.programs where legacy_team_id between 990001 and 990015),
            true
        )
    $$,
    'a second voter can submit a ballot for aggregate scoring'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select is(
    (select count(*)::integer from public.ballots where voter_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
    0,
    'a voter cannot read another voter ballot while the poll is open'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select is(
    (select count(*)::integer from public.ballots where definition_id in (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221')),
    3,
    'an administrator can read all ballots while the poll is open'
);

select lives_ok(
    $$select public.initialize_poll_period('22222222-2222-4222-8222-222222222223')$$,
    'the scheduled-close fixture can be initialized'
);

reset role;
update public.poll_periods
set status = 'open',
    opens_at = now() - interval '2 hours',
    closes_at = now() - interval '1 hour'
where id = '22222222-2222-4222-8222-222222222223';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select throws_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222223' and slug = 'men_team_overall'),
            (select array_agg(id order by legacy_team_id) from public.programs where legacy_team_id between 990001 and 990015),
            true
        )
    $$,
    'This poll is not open',
    'saving is rejected immediately after the scheduled close time'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select throws_ok(
    $$select public.publish_poll_period('22222222-2222-4222-8222-222222222223')$$,
    'Poll period must be closed before publishing',
    'publishing rejects a period that has not been explicitly closed'
);

select lives_ok(
    $$select public.close_poll_period('22222222-2222-4222-8222-222222222221')$$,
    'an administrator can manually close a valid open period'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select throws_ok(
    $$
        select public.save_poll_ballot(
            (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221' and slug = 'men_team_overall'),
            (select array_agg(id order by legacy_team_id) from public.programs where legacy_team_id between 990001 and 990015),
            true
        )
    $$,
    'This poll is not open',
    'closed ballots are immutable'
);

select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
select is(
    (select count(*)::integer from public.ballots where definition_id in (select id from public.ballot_definitions where period_id = '22222222-2222-4222-8222-222222222221')),
    3,
    'authenticated committee members can read individual ballots after close'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select lives_ok(
    $$select public.publish_poll_period('22222222-2222-4222-8222-222222222221')$$,
    'an administrator can publish a closed period'
);

select is(
    (
        select min(points)
        from public.published_poll_results r
        join public.ballot_definitions d on d.id = r.definition_id
        where d.slug = 'men_team_overall'
          and d.period_id = '22222222-2222-4222-8222-222222222221'
    ),
    16,
    'published standings award reverse points from every submitted rank'
);

select is(
    (
        select count(*)::integer
        from public.published_poll_results r
        join public.ballot_definitions d on d.id = r.definition_id
        where d.slug = 'men_team_overall'
          and d.period_id = '22222222-2222-4222-8222-222222222221'
          and r.first_place_votes = 1
    ),
    2,
    'published standings count first-place votes'
);

select is(
    (
        select count(*)::integer
        from public.published_poll_results r
        join public.ballot_definitions d on d.id = r.definition_id
        where d.slug = 'men_team_overall'
          and d.period_id = '22222222-2222-4222-8222-222222222221'
          and r.rank = 1
    ),
    15,
    'published standings preserve equal ranks for equal point totals'
);

select is(
    (
        select array_agg(rank order by rank)
        from public.published_poll_results r
        join public.ballot_definitions d on d.id = r.definition_id
        where d.slug = 'men_team_overall'
          and d.period_id = '22222222-2222-4222-8222-222222222221'
    ),
    array_fill(1, array[15]),
    'published ranks are based only on total points'
);

select lives_ok(
    $$select public.save_committee_access(' ADMIN@EXAMPLE.COM ', 'Updated Admin', 'admin', true, true)$$,
    'an administrator can create a normalized committee access grant'
);

select is(
    (select display_name from public.committee_access_grants where email = 'admin@example.com'),
    'Updated Admin',
    'saving committee access lowercases email and stores the supplied name'
);

reset role;

select is(
    (select display_name from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    'Updated Admin',
    'saving committee access synchronizes an already-linked profile'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

select throws_ok(
    $$select public.save_committee_access('admin@example.com', 'Updated Admin', 'coach', true, true)$$,
    'Cannot deactivate or demote the final active administrator',
    'the final active administrator cannot be demoted'
);

reset role;
select throws_ok(
    $$update auth.users set email = 'ungranted-admin@example.com' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
    'Cannot deactivate or demote the final active administrator',
    'the final active administrator cannot bypass protection by changing auth email'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

select lives_ok(
    $$select public.save_committee_access(' NewCoach@Example.com ', 'New Coach', 'coach', true, true)$$,
    'an administrator can grant voting access without exposing auth users'
);

reset role;
insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
values
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'newcoach@example.com', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('ffffffff-ffff-4fff-8fff-ffffffffffff', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unlisted@example.com', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now());

select ok(
    (select active and can_vote and role = 'coach' from public.profiles where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
    'the auth trigger applies a lowercased committee access grant'
);

select ok(
    (select not active and not can_vote and role = 'coach' from public.profiles where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
    'the auth trigger creates an inactive non-voter when no grant exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-ffffffffffff', true);
select is(
    (select display_name from public.profiles where id = auth.uid()),
    'unlisted',
    'a fresh authenticated user can read their own profile'
);

select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
select is(
    (
        select profile.display_name
        from public.ballots ballot
        join public.ballot_definitions definition on definition.id = ballot.definition_id
        join public.profiles profile on profile.id = ballot.voter_id
        where definition.slug = 'men_team_overall'
          and ballot.voter_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    ),
    'Fixture Voter',
    'authenticated committee visibility includes ballot voter profiles after close'
);

select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-ffffffffffff', true);
select is(
    (select count(*)::integer from public.ballots),
    0,
    'inactive authenticated users cannot read individual ballots after close'
);

reset role;

select ok(
    not has_table_privilege('authenticated', 'public.ballots', 'INSERT')
    and not has_table_privilege('authenticated', 'public.ballots', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.ballot_rankings', 'INSERT')
    and not has_table_privilege('authenticated', 'public.poll_periods', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.poll_spi_snapshots', 'UPDATE'),
    'authenticated users have no direct writes to poll state tables'
);

select ok(
    not has_function_privilege('authenticated', 'public.submit_ballot(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.reopen_ballot(uuid)', 'EXECUTE'),
    'legacy ballot mutation RPCs are no longer executable'
);

select ok(
    not has_table_privilege('anon', 'public.spi_results', 'SELECT')
    and not has_table_privilege('authenticated', 'auth.users', 'SELECT')
    and has_column_privilege('anon', 'public.matches', 'left_sabre', 'SELECT')
    and not has_column_privilege('anon', 'public.matches', 'submitted_by', 'SELECT')
    and not has_column_privilege('anon', 'public.matches', 'submission_email', 'SELECT'),
    'anonymous SPI and sensitive match/auth fields are not exposed'
);

select ok(
    not has_function_privilege('anon', 'public.initialize_poll_period(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.schedule_poll_period(uuid,timestamptz,timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.open_poll_period(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.close_poll_period(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.save_poll_ballot(uuid,uuid[],boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.publish_poll_period(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.save_committee_access(text,text,public.app_role,boolean,boolean)', 'EXECUTE'),
    'anonymous visitors cannot execute any Task 2 RPC'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select is(
    (
        select count(*)::integer
        from public.published_poll_results r
        join public.ballot_definitions d on d.id = r.definition_id
        where d.period_id = '22222222-2222-4222-8222-222222222221'
    ),
    23,
    'anonymous visitors can read only published aggregate result rows'
);

select is(
    (
        select count(*)::integer
        from public.matches
        where source_id = 990001
          and left_sabre = 9
          and right_epee = 5
    ),
    1,
    'anonymous visitors can read approved match score columns'
);

select ok(
    not has_table_privilege('anon', 'public.ballots', 'SELECT'),
    'anonymous visitors cannot read individual ballots'
);
select ok(
    not has_table_privilege('anon', 'public.poll_spi_snapshots', 'SELECT'),
    'anonymous visitors cannot read poll SPI snapshots'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select is((select count(*)::integer from public.committee_access_grants), 0, 'coaches cannot read committee access grants');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select is((select count(*)::integer from public.committee_access_grants), 5, 'administrators can read committee access grants');
select ok((select count(*) > 0 from public.poll_admin_audit_log), 'administrative mutations are audited');

select lives_ok(
    $$
        insert into public.matches (
            source_id,
            season_id,
            fenced_on,
            gender,
            left_program_id,
            right_program_id,
            left_sabre,
            left_foil,
            left_epee,
            right_sabre,
            right_foil,
            right_epee,
            host,
            submitted_by,
            submission_email
        )
        values (
            990002,
            '11111111-1111-4111-8111-111111111111',
            '2026-08-11',
            'Men',
            md5('task-2-program-1')::uuid,
            md5('task-2-program-2')::uuid,
            8,
            8,
            8,
            7,
            7,
            6,
            'Task 2 Admin Match',
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'admin@example.com'
        )
    $$,
    'an authenticated administrator can insert matches through admin-only RLS'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select throws_ok(
    $$
        insert into public.matches (
            source_id,
            season_id,
            fenced_on,
            gender,
            left_program_id,
            right_program_id,
            left_sabre,
            left_foil,
            left_epee,
            right_sabre,
            right_foil,
            right_epee,
            host,
            submitted_by
        )
        values (
            990003,
            '11111111-1111-4111-8111-111111111111',
            '2026-08-12',
            'Men',
            md5('task-2-program-1')::uuid,
            md5('task-2-program-2')::uuid,
            8,
            8,
            8,
            7,
            7,
            6,
            'Task 2 Coach Match',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        )
    $$,
    '42501',
    null,
    'an authenticated coach cannot insert matches'
);
select results_eq(
    $$update public.matches set host = 'Coach Update' where source_id = 990002 returning source_id$$,
    $$values (null::bigint) limit 0$$,
    'an authenticated coach cannot update administrator matches'
);
select results_eq(
    $$delete from public.matches where source_id = 990002 returning source_id$$,
    $$values (null::bigint) limit 0$$,
    'an authenticated coach cannot delete administrator matches'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select results_eq(
    $$update public.matches set host = 'Task 2 Admin Match Updated' where source_id = 990002 returning host$$,
    $$values ('Task 2 Admin Match Updated'::text)$$,
    'an authenticated administrator can update matches through admin-only RLS'
);
select results_eq(
    $$delete from public.matches where source_id = 990002 returning source_id$$,
    $$values (990002::bigint)$$,
    'an authenticated administrator can delete matches through admin-only RLS'
);

reset role;
select * from finish();
rollback;
