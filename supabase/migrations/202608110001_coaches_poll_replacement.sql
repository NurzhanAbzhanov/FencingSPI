alter table public.ballot_definitions
    add column if not exists slug text,
    add column if not exists hidden boolean not null default false,
    add column if not exists archived_at timestamptz;

create unique index if not exists ballot_definitions_period_slug_key
    on public.ballot_definitions(period_id, slug)
    where slug is not null;

create table public.poll_spi_snapshots (
    period_id uuid not null references public.poll_periods(id) on delete cascade,
    program_id uuid not null references public.programs(id) on delete cascade,
    gender public.fencing_gender not null,
    weapon public.fencing_weapon not null,
    spi numeric not null,
    spi_rank integer not null check (spi_rank > 0),
    power_rating numeric,
    division smallint not null check (division in (1, 2, 3)),
    conference text not null,
    region text not null,
    captured_at timestamptz not null default now(),
    primary key (period_id, program_id, weapon)
);

create table public.committee_access_grants (
    email text primary key check (email = lower(btrim(email))),
    display_name text not null,
    role public.app_role not null,
    can_vote boolean not null default false,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.poll_admin_audit_log (
    id bigint generated always as identity primary key,
    period_id uuid references public.poll_periods(id) on delete set null,
    actor_id uuid not null references auth.users(id),
    action text not null,
    detail jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create or replace function public.sync_existing_committee_access_grants()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    synced_count bigint;
begin
    with synced_grants as (
        insert into public.committee_access_grants (
            email,
            display_name,
            role,
            can_vote,
            active
        )
        select
            lower(btrim(u.email)),
            p.display_name,
            p.role,
            p.can_vote,
            p.active
        from public.profiles p
        join auth.users u on u.id = p.id
        where nullif(btrim(u.email), '') is not null
        on conflict (email) do update
        set display_name = excluded.display_name,
            role = excluded.role,
            can_vote = excluded.can_vote,
            active = excluded.active,
            updated_at = now()
        returning 1
    )
    select count(*)
    into synced_count
    from synced_grants;

    return synced_count;
end;
$$;

select public.sync_existing_committee_access_grants();

create or replace function public.create_spi_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_email text := lower(btrim(coalesce(new.email, '')));
    access_grant public.committee_access_grants%rowtype;
    access_grant_found boolean;
    existing_profile_role public.app_role;
    existing_profile_active boolean;
begin
    perform pg_advisory_xact_lock(817202608110002::bigint);

    select g.*
    into access_grant
    from public.committee_access_grants g
    where g.email = normalized_email;

    access_grant_found := found;

    if tg_op = 'UPDATE'
       and lower(btrim(coalesce(old.email, ''))) is distinct from normalized_email then
        select p.role, p.active
        into existing_profile_role, existing_profile_active
        from public.profiles p
        where p.id = new.id
        for update;

        if found
           and existing_profile_role = 'admin'
           and existing_profile_active
           and not (
               access_grant_found
               and access_grant.role = 'admin'
               and access_grant.active
           )
           and not exists (
               select 1
               from public.profiles p
               where p.id <> new.id
                 and p.role = 'admin'
                 and p.active
           ) then
            raise exception 'Cannot deactivate or demote the final active administrator';
        end if;
    end if;

    if access_grant_found then
        insert into public.profiles (id, display_name, role, can_vote, active)
        values (
            new.id,
            access_grant.display_name,
            access_grant.role,
            access_grant.can_vote,
            access_grant.active
        )
        on conflict (id) do update
        set display_name = excluded.display_name,
            role = excluded.role,
            can_vote = excluded.can_vote,
            active = excluded.active;
    else
        insert into public.profiles (id, display_name, role, can_vote, active)
        values (
            new.id,
            coalesce(
                nullif(new.raw_user_meta_data ->> 'display_name', ''),
                nullif(split_part(normalized_email, '@', 1), ''),
                'Inactive user'
            ),
            'coach',
            false,
            false
        )
        on conflict (id) do update
        set display_name = excluded.display_name,
            role = 'coach',
            can_vote = false,
            active = false;
    end if;

    return new;
end;
$$;

drop trigger if exists create_spi_profile_after_auth_signup on auth.users;
create trigger create_spi_profile_after_auth_signup
after insert or update of email on auth.users
for each row execute function public.create_spi_profile_for_auth_user();

drop trigger if exists validate_ballot_ranking_before_write on public.ballot_rankings;
drop function if exists public.validate_ballot_ranking();

create or replace function public.poll_is_open(definition uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((
        select pp.status = 'open'
           and (pp.opens_at is null or pp.opens_at <= now())
           and (pp.closes_at is null or pp.closes_at > now())
        from public.ballot_definitions bd
        join public.poll_periods pp on pp.id = bd.period_id
        where bd.id = definition
    ), false)
$$;

create or replace function public.poll_is_closed(definition uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((
        select pp.status in ('closed', 'published')
            or (
                pp.status = 'open'
                and pp.closes_at is not null
                and pp.closes_at <= now()
            )
        from public.ballot_definitions bd
        join public.poll_periods pp on pp.id = bd.period_id
        where bd.id = definition
    ), false)
$$;

create or replace function public.initialize_poll_period(target_period uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    target_status public.poll_status;
begin
    if public.current_app_role() is distinct from 'admin' then
        raise exception 'Administrator access required';
    end if;

    select status
    into target_status
    from public.poll_periods
    where id = target_period
    for update;

    if not found then
        raise exception 'Poll period not found';
    end if;

    if target_status <> 'draft' then
        raise exception 'Only draft poll periods can be initialized';
    end if;

    insert into public.ballot_definitions (
        period_id,
        slug,
        gender,
        weapon,
        scope,
        rank_limit,
        hidden,
        archived_at
    )
    values
        (target_period, 'men_team_overall', 'Men', 'Team', 'Overall', 15, false, null),
        (target_period, 'women_team_overall', 'Women', 'Team', 'Overall', 15, false, null),
        (target_period, 'men_team_diii', 'Men', 'Team', 'DIII', 8, false, null),
        (target_period, 'women_team_diii', 'Women', 'Team', 'DIII', 8, false, null),
        (target_period, 'men_squad_epee_overall', 'Men', 'Epee', 'Overall', 15, false, null),
        (target_period, 'women_squad_epee_overall', 'Women', 'Epee', 'Overall', 15, false, null),
        (target_period, 'men_squad_foil_overall', 'Men', 'Foil', 'Overall', 15, false, null),
        (target_period, 'women_squad_foil_overall', 'Women', 'Foil', 'Overall', 15, false, null),
        (target_period, 'men_squad_sabre_overall', 'Men', 'Sabre', 'Overall', 15, false, null),
        (target_period, 'women_squad_sabre_overall', 'Women', 'Sabre', 'Overall', 15, false, null),
        (target_period, 'men_squad_epee_diii', 'Men', 'Epee', 'DIII', 5, true, null),
        (target_period, 'women_squad_epee_diii', 'Women', 'Epee', 'DIII', 5, true, null),
        (target_period, 'men_squad_foil_diii', 'Men', 'Foil', 'DIII', 5, true, null),
        (target_period, 'women_squad_foil_diii', 'Women', 'Foil', 'DIII', 5, true, null),
        (target_period, 'men_squad_sabre_diii', 'Men', 'Sabre', 'DIII', 5, true, null),
        (target_period, 'women_squad_sabre_diii', 'Women', 'Sabre', 'DIII', 5, true, null)
    on conflict (period_id, gender, weapon, scope) do update
    set slug = excluded.slug,
        rank_limit = excluded.rank_limit,
        hidden = excluded.hidden,
        archived_at = null;

    update public.ballot_definitions
    set hidden = true,
        archived_at = coalesce(archived_at, now())
    where period_id = target_period
      and (
          slug is null
          or slug not in (
          'men_team_overall',
          'women_team_overall',
          'men_team_diii',
          'women_team_diii',
          'men_squad_epee_overall',
          'women_squad_epee_overall',
          'men_squad_foil_overall',
          'women_squad_foil_overall',
          'men_squad_sabre_overall',
          'women_squad_sabre_overall',
          'men_squad_epee_diii',
          'women_squad_epee_diii',
          'men_squad_foil_diii',
          'women_squad_foil_diii',
          'men_squad_sabre_diii',
          'women_squad_sabre_diii'
          )
      );
end;
$$;

create or replace function public.schedule_poll_period(
    target_period uuid,
    requested_opens_at timestamptz,
    requested_closes_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    target_status public.poll_status;
begin
    if public.current_app_role() is distinct from 'admin' then
        raise exception 'Administrator access required';
    end if;

    if requested_opens_at is not null
       and requested_closes_at is not null
       and requested_opens_at >= requested_closes_at then
        raise exception 'Poll opening time must precede its closing time';
    end if;

    select status
    into target_status
    from public.poll_periods
    where id = target_period
    for update;

    if not found then
        raise exception 'Poll period not found';
    end if;

    if target_status <> 'draft' then
        raise exception 'Only draft poll periods can be scheduled';
    end if;

    update public.poll_periods
    set opens_at = requested_opens_at,
        closes_at = requested_closes_at
    where id = target_period;

    insert into public.poll_admin_audit_log (period_id, actor_id, action, detail)
    values (
        target_period,
        auth.uid(),
        'scheduled',
        jsonb_build_object('opens_at', requested_opens_at, 'closes_at', requested_closes_at)
    );
end;
$$;

create or replace function public.open_poll_period(target_period uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    target_season uuid;
    target_status public.poll_status;
    target_opens_at timestamptz;
    target_closes_at timestamptz;
begin
    if public.current_app_role() is distinct from 'admin' then
        raise exception 'Administrator access required';
    end if;

    perform pg_advisory_xact_lock(817202608110001::bigint);

    with expired_periods as (
        update public.poll_periods
        set status = 'closed'
        where status = 'open'
          and closes_at is not null
          and closes_at <= now()
        returning id
    )
    insert into public.poll_admin_audit_log (period_id, actor_id, action, detail)
    select id, auth.uid(), 'scheduled_close', '{}'::jsonb
    from expired_periods;

    select season_id, status, opens_at, closes_at
    into target_season, target_status, target_opens_at, target_closes_at
    from public.poll_periods
    where id = target_period
    for update;

    if not found then
        raise exception 'Poll period not found';
    end if;

    if target_status <> 'draft' then
        raise exception 'Only draft poll periods can be opened';
    end if;

    if target_opens_at is not null and target_opens_at > now() then
        raise exception 'Poll opening time has not arrived';
    end if;

    if target_closes_at is not null and target_closes_at <= now() then
        raise exception 'Poll closing time must be in the future';
    end if;

    if exists (
        select 1
        from public.poll_periods pp
        where pp.id <> target_period
          and pp.status = 'open'
          and (pp.opens_at is null or pp.opens_at <= now())
          and (pp.closes_at is null or pp.closes_at > now())
    ) then
        raise exception 'Another poll period is already open';
    end if;

    perform public.initialize_poll_period(target_period);

    lock table public.program_seasons, public.spi_results in share mode;

    if exists (
        select 1
        from public.program_seasons ps
        cross join unnest(enum_range(null::public.fencing_weapon)) as required_weapons(weapon)
        where ps.season_id = target_season
          and not exists (
              select 1
              from public.spi_results sr
              where sr.season_id = target_season
                and sr.program_id = ps.program_id
                and sr.weapon = required_weapons.weapon
          )
    ) then
        raise exception 'Calculated SPI snapshot is incomplete';
    end if;

    delete from public.poll_spi_snapshots
    where period_id = target_period;

    insert into public.poll_spi_snapshots (
        period_id,
        program_id,
        gender,
        weapon,
        spi,
        spi_rank,
        power_rating,
        division,
        conference,
        region,
        captured_at
    )
    select
        target_period,
        p.id,
        p.gender,
        sr.weapon,
        sr.spi,
        row_number() over (
            partition by p.gender, sr.weapon
            order by sr.spi desc, lower(btrim(s.name)), p.id
        )::integer,
        sr.power_rating,
        ps.division,
        ps.conference,
        ps.region,
        now()
    from public.program_seasons ps
    join public.programs p on p.id = ps.program_id
    join public.schools s on s.id = p.school_id
    join public.spi_results sr
      on sr.season_id = ps.season_id
     and sr.program_id = ps.program_id
    where ps.season_id = target_season;

    if exists (
        select 1
        from public.program_seasons ps
        cross join unnest(enum_range(null::public.fencing_weapon)) as required_weapons(weapon)
        where ps.season_id = target_season
          and not exists (
              select 1
              from public.poll_spi_snapshots snapshot
              where snapshot.period_id = target_period
                and snapshot.program_id = ps.program_id
                and snapshot.weapon = required_weapons.weapon
          )
    ) then
        raise exception 'Calculated SPI snapshot is incomplete';
    end if;

    update public.poll_periods
    set status = 'open',
        opens_at = coalesce(opens_at, now())
    where id = target_period;

    insert into public.poll_admin_audit_log (period_id, actor_id, action, detail)
    values (
        target_period,
        auth.uid(),
        'opened',
        jsonb_build_object(
            'snapshot_rows',
            (select count(*) from public.poll_spi_snapshots where period_id = target_period)
        )
    );
end;
$$;

create or replace function public.save_poll_ballot(
    target_definition uuid,
    ranked_programs uuid[],
    submit_now boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    definition_period uuid;
    definition_gender public.fencing_gender;
    definition_weapon public.fencing_weapon;
    definition_scope public.poll_scope;
    definition_slug text;
    definition_rank_limit smallint;
    definition_hidden boolean;
    definition_archived_at timestamptz;
    target_season uuid;
    target_status public.poll_status;
    target_opens_at timestamptz;
    target_closes_at timestamptz;
    saved_ballot uuid;
    previous_status public.ballot_status;
    previous_rankings uuid[];
    locked_prefix uuid[] := array[]::uuid[];
    overall_definition uuid;
    overall_ballot uuid;
    eligible_count integer;
    changed_submitted_overall boolean := false;
begin
    if auth.uid() is null or not public.current_user_can_vote() then
        raise exception 'Voting access required';
    end if;

    select
        d.period_id,
        d.gender,
        d.weapon,
        d.scope,
        d.slug,
        d.rank_limit,
        d.hidden,
        d.archived_at,
        pp.season_id,
        pp.status,
        pp.opens_at,
        pp.closes_at
    into
        definition_period,
        definition_gender,
        definition_weapon,
        definition_scope,
        definition_slug,
        definition_rank_limit,
        definition_hidden,
        definition_archived_at,
        target_season,
        target_status,
        target_opens_at,
        target_closes_at
    from public.ballot_definitions d
    join public.poll_periods pp on pp.id = d.period_id
    where d.id = target_definition
    for update of pp;

    if not found then
        raise exception 'Ballot definition not found';
    end if;

    if definition_hidden or definition_archived_at is not null then
        raise exception 'This ballot category is not available';
    end if;

    if target_status <> 'open'
       or (target_opens_at is not null and target_opens_at > now())
       or (target_closes_at is not null and target_closes_at <= now()) then
        raise exception 'This poll is not open';
    end if;

    if coalesce(array_length(ranked_programs, 1), 0) <> definition_rank_limit then
        raise exception 'Ballot requires exactly % ranked programs', definition_rank_limit;
    end if;

    if array_position(ranked_programs, null) is not null then
        raise exception 'Ballot rankings cannot contain null programs';
    end if;

    if (
        select count(*) <> count(distinct rankings.program_id)
        from unnest(ranked_programs) as rankings(program_id)
    ) then
        raise exception 'Ballot rankings must be unique';
    end if;

    select count(*)
    into eligible_count
    from unnest(ranked_programs) as rankings(program_id)
    join public.programs p on p.id = rankings.program_id
    join public.program_seasons ps
      on ps.program_id = p.id
     and ps.season_id = target_season
    join public.poll_spi_snapshots snapshot
      on snapshot.period_id = definition_period
     and snapshot.program_id = p.id
     and snapshot.weapon = definition_weapon
    where p.gender = definition_gender
      and (definition_scope = 'Overall' or snapshot.division = 3);

    if eligible_count <> definition_rank_limit then
        raise exception 'Ballot rankings contain ineligible programs';
    end if;

    if definition_weapon = 'Team' and definition_scope = 'DIII' then
        select id
        into overall_definition
        from public.ballot_definitions
        where period_id = definition_period
          and gender = definition_gender
          and weapon = 'Team'
          and scope = 'Overall'
          and archived_at is null;

        select id
        into overall_ballot
        from public.ballots
        where definition_id = overall_definition
          and voter_id = auth.uid()
          and status = 'submitted';

        if overall_ballot is null then
            raise exception 'Submit the Team Overall ballot before saving Team Division III';
        end if;

        select coalesce(array_agg(prefix_program order by overall_rank), array[]::uuid[])
        into locked_prefix
        from (
            select r.program_id as prefix_program, r.rank as overall_rank
            from public.ballot_rankings r
            join public.poll_spi_snapshots snapshot
              on snapshot.period_id = definition_period
             and snapshot.program_id = r.program_id
             and snapshot.weapon = 'Team'
            where r.ballot_id = overall_ballot
              and snapshot.division = 3
            order by r.rank
            limit definition_rank_limit
        ) prefix_rows;

        if exists (
            select 1
            from unnest(locked_prefix) with ordinality expected(program_id, position)
            where ranked_programs[position] is distinct from expected.program_id
        ) then
            raise exception 'Team Division III ballot must preserve the Overall Division III prefix';
        end if;
    end if;

    select b.id, b.status
    into saved_ballot, previous_status
    from public.ballots b
    where b.definition_id = target_definition
      and b.voter_id = auth.uid()
    for update;

    if found then
        select coalesce(array_agg(r.program_id order by r.rank), array[]::uuid[])
        into previous_rankings
        from public.ballot_rankings r
        where r.ballot_id = saved_ballot;

        changed_submitted_overall := previous_status = 'submitted'
            and definition_weapon = 'Team'
            and definition_scope = 'Overall'
            and previous_rankings is distinct from ranked_programs;
    end if;

    insert into public.ballots (
        definition_id,
        voter_id,
        status,
        submitted_at,
        updated_at
    )
    values (
        target_definition,
        auth.uid(),
        case when submit_now then 'submitted'::public.ballot_status else 'draft'::public.ballot_status end,
        case when submit_now then now() else null end,
        now()
    )
    on conflict (definition_id, voter_id) do update
    set status = excluded.status,
        submitted_at = excluded.submitted_at,
        updated_at = excluded.updated_at
    returning id into saved_ballot;

    delete from public.ballot_rankings
    where ballot_id = saved_ballot;

    insert into public.ballot_rankings (ballot_id, program_id, rank)
    select saved_ballot, program_id, position::smallint
    from unnest(ranked_programs) with ordinality ranking(program_id, position);

    if changed_submitted_overall then
        update public.ballots d3_ballot
        set status = 'draft',
            submitted_at = null,
            updated_at = now()
        from public.ballot_definitions d3_definition
        where d3_ballot.definition_id = d3_definition.id
          and d3_ballot.voter_id = auth.uid()
          and d3_definition.period_id = definition_period
          and d3_definition.gender = definition_gender
          and d3_definition.weapon = 'Team'
          and d3_definition.scope = 'DIII';
    end if;

    insert into public.ballot_audit_log (ballot_id, actor_id, action, detail)
    values (
        saved_ballot,
        auth.uid(),
        case when submit_now then 'submitted' else 'saved' end,
        jsonb_build_object('ranked_programs', ranked_programs)
    );

    return saved_ballot;
end;
$$;

create or replace function public.close_poll_period(target_period uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    target_status public.poll_status;
    target_season uuid;
    d3_ballot record;
    overall_ballot uuid;
    locked_prefix uuid[];
    submitted_rankings uuid[];
begin
    if public.current_app_role() is distinct from 'admin' then
        raise exception 'Administrator access required';
    end if;

    select status, season_id
    into target_status, target_season
    from public.poll_periods
    where id = target_period
    for update;

    if not found then
        raise exception 'Poll period not found';
    end if;

    if target_status <> 'open' then
        raise exception 'Only an open poll period can be closed';
    end if;

    for d3_ballot in
        select b.id, b.voter_id, d.gender, d.rank_limit
        from public.ballots b
        join public.ballot_definitions d on d.id = b.definition_id
        where d.period_id = target_period
          and d.weapon = 'Team'
          and d.scope = 'DIII'
          and b.status = 'submitted'
    loop
        select overall.id
        into overall_ballot
        from public.ballots overall
        join public.ballot_definitions definition on definition.id = overall.definition_id
        where overall.voter_id = d3_ballot.voter_id
          and overall.status = 'submitted'
          and definition.period_id = target_period
          and definition.gender = d3_ballot.gender
          and definition.weapon = 'Team'
          and definition.scope = 'Overall';

        if overall_ballot is null then
            raise exception 'Submitted Team Division III ballot does not match its Team Overall prefix';
        end if;

        select coalesce(array_agg(prefix_program order by overall_rank), array[]::uuid[])
        into locked_prefix
        from (
            select r.program_id as prefix_program, r.rank as overall_rank
            from public.ballot_rankings r
            join public.poll_spi_snapshots snapshot
              on snapshot.period_id = target_period
             and snapshot.program_id = r.program_id
             and snapshot.weapon = 'Team'
            where r.ballot_id = overall_ballot
              and snapshot.division = 3
            order by r.rank
            limit d3_ballot.rank_limit
        ) prefix_rows;

        select coalesce(array_agg(r.program_id order by r.rank), array[]::uuid[])
        into submitted_rankings
        from public.ballot_rankings r
        where r.ballot_id = d3_ballot.id;

        if exists (
            select 1
            from unnest(locked_prefix) with ordinality expected(program_id, position)
            where submitted_rankings[position] is distinct from expected.program_id
        ) then
            raise exception 'Submitted Team Division III ballot does not match its Team Overall prefix';
        end if;
    end loop;

    update public.poll_periods
    set status = 'closed',
        closes_at = case
            when closes_at is null or closes_at > now() then now()
            else closes_at
        end
    where id = target_period;

    insert into public.poll_admin_audit_log (period_id, actor_id, action)
    values (target_period, auth.uid(), 'closed');
end;
$$;

create or replace function public.publish_poll_period(target_period uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    target_status public.poll_status;
begin
    if public.current_app_role() is distinct from 'admin' then
        raise exception 'Administrator access required';
    end if;

    select status
    into target_status
    from public.poll_periods
    where id = target_period
    for update;

    if not found then
        raise exception 'Poll period not found';
    end if;

    if target_status <> 'closed' then
        raise exception 'Poll period must be closed before publishing';
    end if;

    delete from public.published_poll_results result
    using public.ballot_definitions definition
    where result.definition_id = definition.id
      and definition.period_id = target_period;

    insert into public.published_poll_results (
        definition_id,
        program_id,
        points,
        rank,
        first_place_votes,
        published_at
    )
    select
        totals.definition_id,
        totals.program_id,
        totals.points,
        rank() over (
            partition by totals.definition_id
            order by totals.points desc
        )::integer,
        totals.first_place_votes,
        now()
    from (
        select
            b.definition_id,
            r.program_id,
            s.name as school_name,
            sum(d.rank_limit - r.rank + 1)::integer as points,
            count(*) filter (where r.rank = 1)::integer as first_place_votes
        from public.ballots b
        join public.ballot_rankings r on r.ballot_id = b.id
        join public.ballot_definitions d on d.id = b.definition_id
        join public.programs p on p.id = r.program_id
        join public.schools s on s.id = p.school_id
        where d.period_id = target_period
          and b.status = 'submitted'
          and d.archived_at is null
        group by b.definition_id, r.program_id, s.name, d.rank_limit
    ) totals;

    update public.poll_periods
    set status = 'published'
    where id = target_period;

    insert into public.poll_admin_audit_log (period_id, actor_id, action, detail)
    values (
        target_period,
        auth.uid(),
        'published',
        jsonb_build_object(
            'result_rows',
            (
                select count(*)
                from public.published_poll_results result
                join public.ballot_definitions definition on definition.id = result.definition_id
                where definition.period_id = target_period
            )
        )
    );
end;
$$;

create or replace function public.save_committee_access(
    requested_email text,
    requested_display_name text,
    requested_role public.app_role,
    requested_can_vote boolean,
    requested_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_email text := lower(btrim(coalesce(requested_email, '')));
    normalized_display_name text := btrim(coalesce(requested_display_name, ''));
    existing_role public.app_role;
    existing_active boolean;
begin
    if public.current_app_role() is distinct from 'admin' then
        raise exception 'Administrator access required';
    end if;

    perform pg_advisory_xact_lock(817202608110002::bigint);

    if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
        raise exception 'A valid email address is required';
    end if;

    if normalized_display_name = '' then
        raise exception 'Display name is required';
    end if;

    select role, active
    into existing_role, existing_active
    from public.committee_access_grants
    where email = normalized_email
    for update;

    if found
       and existing_role = 'admin'
       and existing_active
       and (requested_role <> 'admin' or not requested_active)
       and not exists (
           select 1
           from public.committee_access_grants
           where email <> normalized_email
             and role = 'admin'
             and active
       ) then
        raise exception 'Cannot deactivate or demote the final active administrator';
    end if;

    insert into public.committee_access_grants (
        email,
        display_name,
        role,
        can_vote,
        active
    )
    values (
        normalized_email,
        normalized_display_name,
        requested_role,
        requested_can_vote,
        requested_active
    )
    on conflict (email) do update
    set display_name = excluded.display_name,
        role = excluded.role,
        can_vote = excluded.can_vote,
        active = excluded.active,
        updated_at = now();

    update public.profiles profile
    set display_name = normalized_display_name,
        role = requested_role,
        can_vote = requested_can_vote,
        active = requested_active
    from auth.users auth_user
    where auth_user.id = profile.id
      and lower(btrim(auth_user.email)) = normalized_email;

    insert into public.poll_admin_audit_log (actor_id, action, detail)
    values (
        auth.uid(),
        'committee_access_saved',
        jsonb_build_object(
            'email', normalized_email,
            'role', requested_role,
            'can_vote', requested_can_vote,
            'active', requested_active
        )
    );
end;
$$;

create or replace function public.list_committee_access()
returns table (
    email text,
    display_name text,
    role public.app_role,
    can_vote boolean,
    active boolean,
    linked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if public.current_app_role() is distinct from 'admin' then
        raise exception 'Administrator access required';
    end if;

    return query
    select
        grant_row.email,
        grant_row.display_name,
        grant_row.role,
        grant_row.can_vote,
        grant_row.active,
        exists (
            select 1
            from auth.users auth_user
            where lower(btrim(auth_user.email)) = grant_row.email
        ) as linked
    from public.committee_access_grants grant_row
    order by lower(grant_row.display_name), grant_row.email;
end;
$$;

create or replace function public.list_poll_participation(target_period uuid)
returns table (
    voter_id uuid,
    voter_name text,
    email text,
    definition_slug text,
    ballot_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if public.current_app_role() is distinct from 'admin' then
        raise exception 'Administrator access required';
    end if;

    return query
    select
        auth_user.id,
        grant_row.display_name,
        grant_row.email,
        definition.slug,
        coalesce(ballot.status::text, 'not_started')
    from public.committee_access_grants grant_row
    join auth.users auth_user
      on lower(btrim(auth_user.email)) = grant_row.email
    join public.profiles profile
      on profile.id = auth_user.id
     and profile.active
     and profile.can_vote
    cross join public.ballot_definitions definition
    left join public.ballots ballot
      on ballot.definition_id = definition.id
     and ballot.voter_id = auth_user.id
    where grant_row.active
      and grant_row.can_vote
      and definition.period_id = target_period
      and not definition.hidden
      and definition.archived_at is null
    order by lower(grant_row.display_name), definition.slug;
end;
$$;

alter table public.poll_spi_snapshots enable row level security;
alter table public.committee_access_grants enable row level security;
alter table public.poll_admin_audit_log enable row level security;

drop policy if exists "Public SPI" on public.spi_results;

do $$
declare
    policy_to_drop record;
begin
    for policy_to_drop in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in (
              'poll_periods',
              'ballot_definitions',
              'ballots',
              'ballot_rankings',
              'published_poll_results',
              'poll_spi_snapshots',
              'committee_access_grants',
              'poll_admin_audit_log'
          )
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            policy_to_drop.policyname,
            policy_to_drop.schemaname,
            policy_to_drop.tablename
        );
    end loop;
end;
$$;

create policy "Approved poll period visibility"
on public.poll_periods for select
using (auth.uid() is not null or status = 'published');

create policy "Approved ballot definition visibility"
on public.ballot_definitions for select
using (
    archived_at is null
    and (
        (
            auth.uid() is not null
            and (not hidden or public.current_app_role() = 'admin')
        )
        or (
            not hidden
            and exists (
                select 1
                from public.poll_periods period
                where period.id = period_id
                  and period.status = 'published'
            )
        )
    )
);

create policy "Open snapshot visibility"
on public.poll_spi_snapshots for select
using (
    auth.uid() is not null
    and (
        public.current_app_role() = 'admin'
        or exists (
            select 1
            from public.poll_periods period
            where period.id = period_id
              and period.status = 'open'
              and (period.opens_at is null or period.opens_at <= now())
              and (period.closes_at is null or period.closes_at > now())
        )
    )
);

create policy "Approved individual ballot visibility"
on public.ballots for select
using (
    public.current_app_role() = 'admin'
    or (
        public.current_app_role() is not null
        and (
            public.poll_is_closed(definition_id)
            or (
                voter_id = auth.uid()
                and public.current_user_can_vote()
                and public.poll_is_open(definition_id)
            )
        )
    )
);

create policy "Approved ballot ranking visibility"
on public.ballot_rankings for select
using (
    exists (
        select 1
        from public.ballots ballot
        where ballot.id = ballot_id
          and (
              public.current_app_role() = 'admin'
              or (
                  public.current_app_role() is not null
                  and (
                      public.poll_is_closed(ballot.definition_id)
                      or (
                          ballot.voter_id = auth.uid()
                          and public.current_user_can_vote()
                          and public.poll_is_open(ballot.definition_id)
                      )
                  )
              )
          )
    )
);

create policy "Public published poll results"
on public.published_poll_results for select
using (true);

create policy "Administrator committee access visibility"
on public.committee_access_grants for select
using (public.current_app_role() = 'admin');

create policy "Administrator poll audit visibility"
on public.poll_admin_audit_log for select
using (public.current_app_role() = 'admin');

revoke insert, update, delete, truncate
on public.poll_periods,
   public.ballot_definitions,
   public.ballots,
   public.ballot_rankings,
   public.published_poll_results,
   public.poll_spi_snapshots,
   public.committee_access_grants,
   public.poll_admin_audit_log,
   public.ballot_audit_log
from anon, authenticated;

grant select on public.poll_periods,
                public.ballot_definitions,
                public.ballots,
                public.ballot_rankings,
                public.published_poll_results,
                public.poll_spi_snapshots,
                public.committee_access_grants,
                public.poll_admin_audit_log,
                public.profiles
to authenticated;

grant select on public.poll_periods,
                public.ballot_definitions,
                public.published_poll_results
to anon;

grant select on public.seasons,
                public.schools,
                public.programs,
                public.program_seasons
to anon, authenticated;

revoke select on public.spi_results from anon, authenticated;
grant select on public.spi_results to authenticated;

revoke select on public.matches from anon;
grant select, insert, update, delete on public.matches to authenticated;
grant select (
    id,
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
    created_at
)
on public.matches to anon;

revoke execute on function public.submit_ballot(uuid) from public, anon, authenticated;
revoke execute on function public.reopen_ballot(uuid) from public, anon, authenticated;

revoke execute on function public.initialize_poll_period(uuid) from public, anon;
revoke execute on function public.schedule_poll_period(uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.open_poll_period(uuid) from public, anon;
revoke execute on function public.close_poll_period(uuid) from public, anon;
revoke execute on function public.save_poll_ballot(uuid, uuid[], boolean) from public, anon;
revoke execute on function public.publish_poll_period(uuid) from public, anon;
revoke execute on function public.save_committee_access(text, text, public.app_role, boolean, boolean) from public, anon;
revoke execute on function public.list_committee_access() from public, anon;
revoke execute on function public.list_poll_participation(uuid) from public, anon;
revoke execute on function public.create_spi_profile_for_auth_user() from public, anon, authenticated;
revoke execute on function public.sync_existing_committee_access_grants() from public, anon, authenticated;

grant execute on function public.initialize_poll_period(uuid) to authenticated;
grant execute on function public.schedule_poll_period(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.open_poll_period(uuid) to authenticated;
grant execute on function public.close_poll_period(uuid) to authenticated;
grant execute on function public.save_poll_ballot(uuid, uuid[], boolean) to authenticated;
grant execute on function public.publish_poll_period(uuid) to authenticated;
grant execute on function public.save_committee_access(text, text, public.app_role, boolean, boolean) to authenticated;
grant execute on function public.list_committee_access() to authenticated;
grant execute on function public.list_poll_participation(uuid) to authenticated;
