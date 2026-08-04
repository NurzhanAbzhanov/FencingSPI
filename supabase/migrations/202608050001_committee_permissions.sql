alter table public.profiles
add column if not exists can_vote boolean not null default false;

alter table public.matches
add column if not exists submission_email text;

create or replace function public.current_user_can_vote()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((
        select can_vote
        from public.profiles
        where id = auth.uid() and active = true
    ), false)
$$;

create or replace function public.create_spi_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_email text := lower(coalesce(new.email, ''));
begin
    insert into public.profiles (id, display_name, role, can_vote, active)
    values (
        new.id,
        coalesce(
            nullif(new.raw_user_meta_data ->> 'display_name', ''),
            split_part(normalized_email, '@', 1)
        ),
        case
            when normalized_email in ('nabzhanov@ucsd.edu', 'jic330@ucsd.edu')
                then 'admin'::public.app_role
            else 'coach'::public.app_role
        end,
        normalized_email = 'jic330@ucsd.edu',
        true
    )
    on conflict (id) do update
    set role = excluded.role,
        can_vote = excluded.can_vote,
        active = true;

    return new;
end;
$$;

drop trigger if exists create_spi_profile_after_auth_signup on auth.users;
create trigger create_spi_profile_after_auth_signup
after insert or update of email on auth.users
for each row execute function public.create_spi_profile_for_auth_user();

insert into public.profiles (id, display_name, role, can_vote, active)
select
    id,
    coalesce(
        nullif(raw_user_meta_data ->> 'display_name', ''),
        split_part(lower(email), '@', 1)
    ),
    'admin'::public.app_role,
    lower(email) = 'jic330@ucsd.edu',
    true
from auth.users
where lower(email) in ('nabzhanov@ucsd.edu', 'jic330@ucsd.edu')
on conflict (id) do update
set role = 'admin'::public.app_role,
    can_vote = excluded.can_vote,
    active = true;

drop policy if exists "Coaches create own ballots" on public.ballots;
drop policy if exists "Coaches update own ballots" on public.ballots;
drop policy if exists "Coaches edit own rankings" on public.ballot_rankings;

create policy "Voters create own ballots"
on public.ballots for insert
with check (
    voter_id = auth.uid()
    and public.current_user_can_vote()
    and public.poll_is_open(definition_id)
);

create policy "Voters update own ballots"
on public.ballots for update
using (
    voter_id = auth.uid()
    and public.current_user_can_vote()
    and public.poll_is_open(definition_id)
)
with check (
    voter_id = auth.uid()
    and public.current_user_can_vote()
    and public.poll_is_open(definition_id)
);

create policy "Voters edit own rankings"
on public.ballot_rankings for all
using (exists (
    select 1
    from public.ballots b
    where b.id = ballot_id
      and b.voter_id = auth.uid()
      and public.current_user_can_vote()
      and public.poll_is_open(b.definition_id)
))
with check (exists (
    select 1
    from public.ballots b
    where b.id = ballot_id
      and b.voter_id = auth.uid()
      and public.current_user_can_vote()
      and public.poll_is_open(b.definition_id)
));

create or replace function public.submit_ballot(target_ballot uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    expected_count integer;
    actual_count integer;
    owner_id uuid;
    period_status public.poll_status;
begin
    select b.voter_id, bd.rank_limit, pp.status
    into owner_id, expected_count, period_status
    from public.ballots b
    join public.ballot_definitions bd on bd.id = b.definition_id
    join public.poll_periods pp on pp.id = bd.period_id
    where b.id = target_ballot;

    if owner_id is null
       or owner_id <> auth.uid()
       or not public.current_user_can_vote() then
        raise exception 'Ballot not found or voting access denied';
    end if;
    if period_status <> 'open' then
        raise exception 'This poll is not open';
    end if;

    select count(*) into actual_count
    from public.ballot_rankings
    where ballot_id = target_ballot;

    if actual_count <> expected_count then
        raise exception 'Ballot requires exactly % ranked programs', expected_count;
    end if;

    update public.ballots
    set status = 'submitted', submitted_at = now(), updated_at = now()
    where id = target_ballot;

    insert into public.ballot_audit_log (ballot_id, actor_id, action)
    values (target_ballot, auth.uid(), 'submitted');
end;
$$;

drop policy if exists "Admins manage matches" on public.matches;
create policy "Admins manage matches"
on public.matches for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

grant execute on function public.current_user_can_vote() to authenticated;
