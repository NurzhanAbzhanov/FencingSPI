drop policy if exists "Voters update own ballots" on public.ballots;
drop policy if exists "Voters edit own rankings" on public.ballot_rankings;

create policy "Voters update editable own ballots"
on public.ballots for update
using (
    (
        voter_id = auth.uid()
        and status <> 'submitted'
        and public.current_user_can_vote()
        and public.poll_is_open(definition_id)
    )
    or public.current_app_role() = 'admin'
)
with check (
    (
        voter_id = auth.uid()
        and status <> 'submitted'
        and public.current_user_can_vote()
        and public.poll_is_open(definition_id)
    )
    or public.current_app_role() = 'admin'
);

create policy "Voters edit editable own rankings"
on public.ballot_rankings for all
using (exists (
    select 1
    from public.ballots b
    where b.id = ballot_id
      and (
        (
            b.voter_id = auth.uid()
            and b.status <> 'submitted'
            and public.current_user_can_vote()
            and public.poll_is_open(b.definition_id)
        )
        or public.current_app_role() = 'admin'
      )
))
with check (exists (
    select 1
    from public.ballots b
    where b.id = ballot_id
      and (
        (
            b.voter_id = auth.uid()
            and b.status <> 'submitted'
            and public.current_user_can_vote()
            and public.poll_is_open(b.definition_id)
        )
        or public.current_app_role() = 'admin'
      )
));

create or replace function public.reopen_ballot(target_ballot uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if public.current_app_role() <> 'admin' then
        raise exception 'Administrator access required';
    end if;

    if not exists (select 1 from public.ballots where id = target_ballot and status = 'submitted') then
        raise exception 'Submitted ballot not found';
    end if;

    update public.ballots
    set status = 'reopened', submitted_at = null, updated_at = now()
    where id = target_ballot;

    insert into public.ballot_audit_log (ballot_id, actor_id, action)
    values (target_ballot, auth.uid(), 'reopened');
end;
$$;

grant execute on function public.reopen_ballot(uuid) to authenticated;
