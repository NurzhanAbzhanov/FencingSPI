begin;

-- The deployed poll implementation stores ballots in votes, not ballots.
create table if not exists public.votes (
    id uuid primary key default gen_random_uuid(),
    poll_id text not null,
    voter_id uuid not null references public.profiles(id),
    category text not null,
    rankings jsonb not null default '[]',
    status text not null default 'draft',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(poll_id, voter_id, category)
);

create or replace function public.is_active_poll_member()
returns boolean language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.profiles p
        join auth.users u on u.id = p.id
        join public.committee_access_grants g on g.email = lower(btrim(u.email))
        where p.id = auth.uid() and p.active and p.can_vote and g.active and g.can_vote
    );
$$;

create or replace function public.vote_period_open(target_period text)
returns boolean language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.poll_periods p where p.id::text = target_period
        and p.status = 'open' and (p.opens_at is null or p.opens_at <= now())
        and (p.closes_at is null or p.closes_at > now()));
$$;

create or replace function public.vote_period_closed(target_period text)
returns boolean language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.poll_periods p where p.id::text = target_period
        and (p.status in ('closed','published') or (p.status = 'open' and p.closes_at <= now())));
$$;

alter table public.votes enable row level security;
alter table public.poll_periods enable row level security;
-- Remove every permissive policy, including policies created outside migrations.
do $$ declare policy record; begin
    for policy in select tablename,policyname from pg_policies where schemaname='public'
        and tablename in ('votes','poll_periods') loop
        execute format('drop policy %I on public.%I', policy.policyname, policy.tablename);
    end loop;
end $$;

revoke all on public.votes from public, anon, authenticated;
grant select, insert, update, delete on public.votes to authenticated;
create policy committee_vote_read on public.votes for select to authenticated using (
    public.current_app_role() = 'admin' or (public.is_active_poll_member() and
        (voter_id = auth.uid() or (status = 'submitted' and public.vote_period_closed(poll_id))))
);
create policy committee_vote_insert on public.votes for insert to authenticated with check (
    voter_id = auth.uid() and public.is_active_poll_member() and public.vote_period_open(poll_id)
);
create policy committee_vote_update on public.votes for update to authenticated
    using (voter_id = auth.uid() and public.is_active_poll_member())
    with check (voter_id = auth.uid() and public.is_active_poll_member() and public.vote_period_open(poll_id));
create policy admin_vote_delete on public.votes for delete to authenticated using (public.current_app_role() = 'admin');

revoke all on public.poll_periods from public, anon, authenticated;
grant select on public.poll_periods to anon, authenticated;
grant insert, update, delete on public.poll_periods to authenticated;
create policy public_poll_schedule on public.poll_periods for select to anon, authenticated using (true);
create policy admin_poll_schedule on public.poll_periods for all to authenticated
    using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create or replace function public.enforce_committee_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
    period public.poll_periods%rowtype;
    ballot_gender public.fencing_gender;
    rank_limit integer;
    ids bigint[];
    overall jsonb;
    prefix bigint[];
    is_d3 boolean;
begin
    -- Keep trusted service/database maintenance available; browser roles cannot use it.
    if auth.role() = 'service_role' or (session_user = 'postgres' and current_setting('role') = 'none') then
        if tg_op = 'DELETE' then return old; else return new; end if;
    end if;
    if tg_op = 'DELETE' then
        if public.current_app_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
        return old;
    end if;
    if auth.uid() is null or new.voter_id is distinct from auth.uid() or not public.is_active_poll_member() then
        raise exception 'Voting access required';
    end if;
    if tg_op = 'UPDATE' then
        if old.status = 'submitted' then raise exception 'Submitted ballots are locked. Ask an administrator to reset it.'; end if;
        if (new.id,new.poll_id,new.voter_id,new.category,new.created_at) is distinct from
            (old.id,old.poll_id,old.voter_id,old.category,old.created_at) then
            raise exception 'Ballot identity cannot be changed';
        end if;
    end if;
    select * into period from public.poll_periods where id::text = new.poll_id for update;
    if not found or period.status <> 'open' or period.opens_at > now() or period.closes_at <= now() then
        raise exception 'This poll is not open';
    end if;
    if new.category !~ '^(men|women)_(team_(overall|diii)|squad_(epee|foil|sabre)(_overall)?)$' then
        raise exception 'Invalid poll category';
    end if;
    if new.status is null or new.status not in ('draft','submitted') then raise exception 'Invalid ballot status'; end if;
    ballot_gender := case when new.category like 'men_%' then 'Men'::public.fencing_gender else 'Women'::public.fencing_gender end;
    is_d3 := new.category like '%_diii';
    rank_limit := case when is_d3 then 8 else 15 end;
    if new.rankings is null or jsonb_typeof(new.rankings) <> 'array' then raise exception 'Rankings must be an array'; end if;
    if exists (select 1 from jsonb_array_elements(new.rankings) item where jsonb_typeof(item) <> 'number' or item::text !~ '^[1-9][0-9]*$') then
        raise exception 'Rankings must contain positive integer team IDs';
    end if;
    select coalesce(array_agg(value::bigint order by position),array[]::bigint[]) into ids
        from jsonb_array_elements_text(new.rankings) with ordinality as ranked(value,position);
    if cardinality(ids) > rank_limit or (new.status = 'submitted' and cardinality(ids) <> rank_limit) then
        raise exception 'Ballot requires % ranked teams',rank_limit;
    end if;
    if cardinality(ids) <> (select count(distinct id) from unnest(ids) id) then raise exception 'Ballot rankings must be unique'; end if;
    if cardinality(ids) <> (select count(*) from public.programs p join public.program_seasons ps
        on ps.program_id = p.id and ps.season_id = period.season_id
        where p.legacy_team_id = any(ids) and p.gender = ballot_gender and (not is_d3 or ps.division = 3)) then
        raise exception 'Ballot contains ineligible teams';
    end if;
    if is_d3 then
        select rankings into overall from public.votes where poll_id = new.poll_id and voter_id = auth.uid()
            and category = replace(new.category,'_diii','_overall') and status = 'submitted';
        if overall is null then raise exception 'Submit the overall ballot first'; end if;
        select coalesce(array_agg(team_id order by position),array[]::bigint[]) into prefix from (
            select value::bigint as team_id, position from jsonb_array_elements_text(overall) with ordinality as ranked(value,position)
            join public.programs p on p.legacy_team_id = value::bigint
            join public.program_seasons ps on ps.program_id = p.id and ps.season_id = period.season_id
            where ps.division = 3 order by position limit rank_limit
        ) locked;
        if ids[1:cardinality(prefix)] is distinct from prefix and cardinality(prefix) > 0 then
            raise exception 'DIII ballot must preserve the overall DIII order';
        end if;
    end if;
    new.updated_at := now();
    if tg_op = 'INSERT' then new.created_at := now(); end if;
    return new;
end;
$$;
drop trigger if exists secure_committee_vote on public.votes;
create trigger secure_committee_vote before insert or update or delete on public.votes
    for each row execute function public.enforce_committee_vote();

create or replace function public.save_committee_vote(target_period uuid, target_category text, ranked_teams bigint[], submit_now boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved uuid; begin
    if auth.uid() is null or not public.is_active_poll_member() then raise exception 'Voting access required'; end if;
    insert into public.votes(poll_id,voter_id,category,rankings,status)
    values(target_period::text,auth.uid(),target_category,to_jsonb(coalesce(ranked_teams,array[]::bigint[])),case when submit_now then 'submitted' else 'draft' end)
    on conflict(poll_id,voter_id,category) do update set rankings=excluded.rankings,status=excluded.status
    returning id into saved;
    return saved;
end;
$$;

create or replace function public.reset_committee_vote(target_vote uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare vote public.votes%rowtype; begin
    if public.current_app_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
    select * into vote from public.votes where id = target_vote for update;
    if not found then raise exception 'Ballot not found'; end if;
    if public.vote_period_closed(vote.poll_id) then raise exception 'Closed polls cannot be reset'; end if;
    delete from public.votes where id = vote.id or (poll_id = vote.poll_id and voter_id = vote.voter_id
        and vote.category in ('men_team_overall','women_team_overall') and category = replace(vote.category,'_overall','_diii'));
    insert into public.poll_admin_audit_log(actor_id,period_id,action,detail)
        values(auth.uid(),vote.poll_id::uuid,'vote_reset',jsonb_build_object('vote_id',vote.id,'voter_id',vote.voter_id,'category',vote.category));
end;
$$;

revoke all on function public.enforce_committee_vote() from public, anon, authenticated;
revoke all on function public.is_active_poll_member(), public.vote_period_open(text), public.vote_period_closed(text),
    public.save_committee_vote(uuid,text,bigint[],boolean), public.reset_committee_vote(uuid) from public, anon;
grant execute on function public.is_active_poll_member(), public.vote_period_open(text), public.vote_period_closed(text),
    public.save_committee_vote(uuid,text,bigint[],boolean), public.reset_committee_vote(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
