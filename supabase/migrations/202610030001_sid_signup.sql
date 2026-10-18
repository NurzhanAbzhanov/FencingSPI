begin;
create table public.sid_registrations (
    id uuid primary key,
    name text not null check (char_length(btrim(name)) between 2 and 120),
    school text not null check (char_length(btrim(school)) between 2 and 200),
    email text not null check (char_length(email) <= 254),
    created_at timestamptz not null default now()
);
create unique index sid_registration_contact on public.sid_registrations(lower(email), lower(school));
create index sid_registration_created on public.sid_registrations(created_at desc);
alter table public.sid_registrations enable row level security;
revoke all on public.sid_registrations from anon, authenticated;
grant select on public.sid_registrations to authenticated;
create policy sid_admin_read on public.sid_registrations for select to authenticated
    using (public.current_app_role() = 'admin');

create function public.register_sid(p_request_id uuid, p_name text, p_school text, p_email text, p_website text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
    if coalesce(p_website, '') <> '' then return; end if;
    p_name := btrim(p_name);
    p_school := regexp_replace(btrim(p_school), '[[:space:]]+', ' ', 'g');
    p_email := lower(btrim(p_email));
    if p_request_id is null then raise exception 'Invalid registration.'; end if;
    if p_name is null or char_length(p_name) not between 2 and 120 then raise exception 'Enter your name (2 to 120 characters).'; end if;
    if p_school is null or char_length(p_school) not between 2 and 200 then raise exception 'Enter your school (2 to 200 characters).'; end if;
    if p_email is null or char_length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'Enter a valid email address.';
    end if;
    perform pg_advisory_xact_lock(20261003, 1);
    -- Retries and repeat signups do not overwrite previously submitted contact details.
    if exists (select 1 from public.sid_registrations where id = p_request_id or (lower(email)=p_email and lower(school)=lower(p_school))) then return; end if;
    if (select count(*) from public.sid_registrations where created_at > now() - interval '1 hour') >= 30
       or (select count(*) from public.sid_registrations where created_at > now() - interval '1 day') >= 150 then
        raise exception 'We are receiving a lot of registrations. Please try again later.';
    end if;
    insert into public.sid_registrations(id, name, school, email) values(p_request_id, p_name, p_school, p_email);
end;
$$;
revoke all on function public.register_sid(uuid,text,text,text,text) from public;
grant execute on function public.register_sid(uuid,text,text,text,text) to anon, authenticated;
commit;
