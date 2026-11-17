begin;
insert into auth.users(id,email) values('c1000000-0000-4000-8000-000000000001','calendar-admin@example.com'),('c1000000-0000-4000-8000-000000000002','calendar-voter@example.com');
insert into public.profiles(id,display_name,role,active,can_vote) values
('c1000000-0000-4000-8000-000000000001','Calendar fixture','admin',true,false),
('c1000000-0000-4000-8000-000000000002','Voter fixture','coach',true,true)
on conflict(id) do update set role=excluded.role,active=true,can_vote=excluded.can_vote;
do $$
declare first_id uuid; second_id uuid; blocked boolean; fixture text:='<html><head></head><body>Calendar fixture</body></html>';
begin
    perform set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
    first_id:=public.save_calendar_version('first.html',fixture);
    perform public.publish_calendar_version(first_id);
    second_id:=public.save_calendar_version('second.html',replace(fixture,'fixture','second'));
    if (select id from public.get_published_calendar())<>first_id then raise exception 'Draft upload replaced the published calendar'; end if;
    blocked:=false;
    begin perform public.publish_calendar_version('00000000-0000-4000-8000-000000000099'); exception when raise_exception then blocked:=true; end;
    if not blocked or (select id from public.get_published_calendar())<>first_id then raise exception 'Failed publication changed the pointer'; end if;
    perform public.publish_calendar_version(second_id);
    perform public.publish_calendar_version(first_id);
    if (select id from public.get_published_calendar())<>first_id then raise exception 'Restore failed'; end if;
    blocked:=false;
    begin perform public.save_calendar_version('bad.txt',fixture); exception when raise_exception then blocked:=true; end;
    if not blocked then raise exception 'Non-HTML file accepted'; end if;
    blocked:=false;
    begin perform public.save_calendar_version('large.html',repeat('a',1048577)); exception when raise_exception then blocked:=true; end;
    if not blocked then raise exception 'Oversized file accepted'; end if;
    perform set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
    blocked:=false;
    begin perform public.save_calendar_version('voter.html',fixture); exception when raise_exception then blocked:=true; end;
    if not blocked then raise exception 'Voter could upload'; end if;
    blocked:=false;
    begin perform public.publish_calendar_version(second_id); exception when raise_exception then blocked:=true; end;
    if not blocked then raise exception 'Voter could publish'; end if;
    perform set_config('request.jwt.claim.sub','',true);
    blocked:=false;
    begin perform public.save_calendar_version('anon.html',fixture); exception when raise_exception then blocked:=true; end;
    if not blocked then raise exception 'Anonymous upload accepted'; end if;
    if (select count(*) from public.get_published_calendar())<>1 then raise exception 'Public reader must receive only published source'; end if;
    if has_table_privilege('anon','public.calendar_versions','select') then raise exception 'Anonymous history access'; end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
do $$ begin
    if exists(select 1 from public.calendar_versions) then raise exception 'Voter can read private history'; end if;
end; $$;
reset role;
rollback;
