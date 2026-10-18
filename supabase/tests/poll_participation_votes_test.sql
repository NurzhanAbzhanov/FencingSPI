begin;

-- Read-only assertions against existing committee accounts; all session changes roll back.
do $$
declare
    admin_id uuid;
    period_id uuid;
    expected_members integer;
    actual_rows integer;
    denied boolean := false;
begin
    select id into admin_id from public.profiles where active and role = 'admin' limit 1;
    select id into period_id from public.poll_periods order by opens_at desc nulls last limit 1;
    if admin_id is null or period_id is null then
        raise exception 'Test requires an active administrator and a poll period';
    end if;
    select count(*) into expected_members from public.committee_access_grants g
        join auth.users u on lower(btrim(u.email)) = g.email
        join public.profiles p on p.id = u.id
        where g.active and g.can_vote and p.active and p.can_vote;
    if has_function_privilege('anon', 'public.list_poll_participation(uuid)', 'EXECUTE') then
        raise exception 'Anonymous participation access must be blocked';
    end if;
    perform set_config('request.jwt.claim.sub', admin_id::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into actual_rows from public.list_poll_participation(period_id);
    if actual_rows <> expected_members * 10 then
        raise exception 'Expected % participation rows, got %', expected_members * 10, actual_rows;
    end if;
    if exists (select 1 from public.list_poll_participation(period_id)
        where ballot_status not in ('not_started', 'draft', 'submitted')
           or definition_slug !~ '^(men|women)_(team_(overall|diii)|squad_(epee|foil|sabre)_overall)$') then
        raise exception 'Participation statuses or category names are invalid';
    end if;
    if exists (select 1 from public.list_poll_participation('00000000-0000-0000-0000-000000000000')) then
        raise exception 'Unknown polls must not return participation';
    end if;
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
    begin
        perform * from public.list_poll_participation(period_id);
    exception when raise_exception then
        if sqlerrm <> 'Administrator access required' then raise; end if;
        denied := true;
    end;
    if not denied then raise exception 'Nonadmin participation access must be blocked'; end if;
end;
$$;

rollback;
