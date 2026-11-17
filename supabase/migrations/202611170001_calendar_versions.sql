begin;

create table public.calendar_versions (
    id uuid primary key default gen_random_uuid(),
    filename text not null check(length(filename) between 1 and 200),
    html text not null check(octet_length(html) between 1 and 1048576),
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id)
);
create table public.calendar_publication (
    singleton boolean primary key default true check(singleton),
    version_id uuid not null references public.calendar_versions(id),
    published_at timestamptz not null default now(),
    published_by uuid references auth.users(id)
);
alter table public.calendar_versions enable row level security;
alter table public.calendar_publication enable row level security;
revoke all on public.calendar_versions,public.calendar_publication from anon,authenticated;
grant select on public.calendar_versions,public.calendar_publication to authenticated;
create policy "Admins read calendar versions" on public.calendar_versions for select to authenticated
    using(public.current_app_role()='admin');
create policy "Admins read calendar publication" on public.calendar_publication for select to authenticated
    using(public.current_app_role()='admin');

create function public.save_calendar_version(p_filename text,p_html text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
    if public.current_app_role() is distinct from 'admin' then raise exception 'Admin access required'; end if;
    if p_filename is null or length(btrim(p_filename)) not between 1 and 200 or p_filename !~* '\.html?$' then
        raise exception 'Select an .html or .htm file'; end if;
    if p_html is null or octet_length(p_html) not between 1 and 1048576 then raise exception 'HTML must be nonempty and no larger than 1 MiB'; end if;
    if p_html !~* '<html[[:space:]>]' or p_html !~* '<body[[:space:]>]' then raise exception 'Upload a standalone HTML document'; end if;
    insert into public.calendar_versions(filename,html,created_by) values(btrim(p_filename),p_html,auth.uid()) returning id into result;
    return result;
end;
$$;

create function public.publish_calendar_version(p_version_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
    if public.current_app_role() is distinct from 'admin' then raise exception 'Admin access required'; end if;
    if not exists(select 1 from public.calendar_versions where id=p_version_id) then raise exception 'Calendar version not found'; end if;
    insert into public.calendar_publication(singleton,version_id,published_at,published_by) values(true,p_version_id,now(),auth.uid())
    on conflict(singleton) do update set version_id=excluded.version_id,published_at=excluded.published_at,published_by=excluded.published_by;
end;
$$;

create function public.get_published_calendar()
returns table(id uuid,filename text,html text,created_at timestamptz,published_at timestamptz)
language sql stable security definer set search_path='' as $$
    select v.id,v.filename,v.html,v.created_at,p.published_at
    from public.calendar_publication p join public.calendar_versions v on v.id=p.version_id where p.singleton;
$$;
revoke all on function public.save_calendar_version(text,text),public.publish_calendar_version(uuid),public.get_published_calendar() from public,anon,authenticated;
grant execute on function public.save_calendar_version(text,text),public.publish_calendar_version(uuid) to authenticated;
grant execute on function public.get_published_calendar() to anon,authenticated;

notify pgrst, 'reload schema';
commit;
