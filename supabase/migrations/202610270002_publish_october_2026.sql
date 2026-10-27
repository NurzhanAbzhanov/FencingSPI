begin;
do $$
declare actor uuid; target uuid; target_status public.poll_status;
begin
    select p.id into actor from public.profiles p join auth.users u on u.id=p.id
        where lower(u.email)='nabzhanov@ucsd.edu' and p.active and p.role='admin';
    if actor is null then raise exception 'Publication administrator is not available'; end if;
    select p.id,p.status into target,target_status from public.poll_periods p join public.seasons s on s.id=p.season_id
        where s.slug='2026-27' and p.month=10;
    if target is null then raise exception 'October 2026-27 poll was not found'; end if;
    if target_status <> 'published' then
        perform set_config('request.jwt.claim.sub',actor::text,true);
        perform public.publish_poll_period(target);
    end if;
    update public.seasons set is_active=false where is_active and slug<>'2026-27';
    update public.seasons set is_active=true where slug='2026-27';
end;
$$;
commit;
