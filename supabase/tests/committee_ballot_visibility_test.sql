begin;

-- Verify the live API role against actual rows without changing ballot data.
do $$
declare
    member_id uuid;
    submitted_count integer;
    own_draft_count integer;
    visible_count integer;
begin
    select p.id into member_id from public.profiles p
        join auth.users u on u.id = p.id
        join public.committee_access_grants g on g.email = lower(btrim(u.email))
        where p.active and p.can_vote and g.active and g.can_vote and p.role <> 'admin'
        limit 1;
    if member_id is null then raise exception 'Test requires an active nonadmin voter'; end if;
    select count(*) into submitted_count from public.votes where status = 'submitted';
    select count(*) into own_draft_count from public.votes where status <> 'submitted' and voter_id = member_id;
    perform set_config('request.jwt.claim.sub', member_id::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into visible_count from public.votes;
    if visible_count <> submitted_count + own_draft_count then
        raise exception 'Committee member cannot see every submitted ballot';
    end if;
    if exists (select 1 from public.votes where status <> 'submitted' and voter_id <> member_id) then
        raise exception 'Another voters draft was exposed';
    end if;
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
    if exists (select 1 from public.votes) then raise exception 'Noncommittee access was exposed'; end if;
    if has_table_privilege('anon', 'public.votes', 'SELECT') then
        raise exception 'Anonymous ballot access was exposed';
    end if;
end;
$$;

rollback;
