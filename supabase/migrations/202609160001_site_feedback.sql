begin;

create table public.site_feedback (
    id uuid primary key,
    client_id uuid not null,
    created_at timestamptz not null default now(),
    kind text not null check (kind in ('problem', 'suggestion', 'other')),
    message text not null check (char_length(btrim(message)) between 10 and 4000),
    email text check (email is null or char_length(email) <= 254),
    context jsonb not null,
    screenshot text,
    has_screenshot boolean generated always as (screenshot is not null) stored,
    status text not null default 'new' check (status in ('new', 'in_progress', 'resolved'))
);
create index site_feedback_created on public.site_feedback (created_at desc);
create index site_feedback_client_created on public.site_feedback (client_id, created_at desc);
alter table public.site_feedback enable row level security;
revoke all on public.site_feedback from anon, authenticated;
grant select on public.site_feedback to authenticated;
grant update (status) on public.site_feedback to authenticated;
create policy feedback_admin_read on public.site_feedback for select to authenticated
    using (public.current_app_role() = 'admin');
create policy feedback_admin_status on public.site_feedback for update to authenticated
    using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create function public.submit_site_feedback(
    p_request_id uuid, p_client_id uuid, p_kind text, p_message text,
    p_email text, p_context jsonb, p_screenshot text default null, p_website text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare
    image_bytes bytea;
begin
    -- Quietly discard automated form fills. No public table writes or reads are allowed.
    if coalesce(p_website, '') <> '' then return; end if;
    if p_request_id is null or p_client_id is null then raise exception 'Invalid submission.'; end if;
    if p_kind is null or p_kind not in ('problem', 'suggestion', 'other') then raise exception 'Choose a feedback type.'; end if;
    if p_message is null or char_length(btrim(p_message)) not between 10 and 4000 then
        raise exception 'Feedback must be between 10 and 4000 characters.';
    end if;
    p_email := nullif(btrim(p_email), '');
    if p_email is not null and (char_length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
        raise exception 'Enter a valid email address or leave it blank.';
    end if;
    if p_context is null or jsonb_typeof(p_context) <> 'object' or octet_length(p_context::text) > 4000 then
        raise exception 'Invalid page context.';
    end if;
    if jsonb_typeof(p_context->'pageUrl') is distinct from 'string'
        or (p_context->>'pageUrl') !~ '^https?://'
        or jsonb_typeof(p_context->'season') is distinct from 'string'
        or char_length(p_context->>'season') > 30
        or (p_context - array['pageUrl', 'season', 'filters']) <> '{}'::jsonb then
        raise exception 'Invalid page context.';
    end if;
    if p_context ? 'filters' then
        if jsonb_typeof(p_context->'filters') <> 'object' then raise exception 'Invalid filters.'; end if;
        if exists (select 1 from jsonb_each(p_context->'filters') as f where jsonb_typeof(f.value) <> 'string' or char_length(f.value::text) > 150)
            then raise exception 'Invalid filters.'; end if;
    end if;
    if p_screenshot is not null then
        if char_length(p_screenshot) > 700000 or p_screenshot !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then
            raise exception 'Invalid screenshot. Please choose another image.';
        end if;
        begin
            image_bytes := decode(substring(p_screenshot from 24), 'base64');
        exception when others then raise exception 'Invalid screenshot.';
        end;
        if encode(substring(image_bytes from 1 for 3), 'hex') <> 'ffd8ff' then raise exception 'Invalid screenshot.'; end if;
    end if;

    -- Serialize counters to enforce limits even under concurrent anonymous requests.
    -- Client IDs are a convenience throttle, not an identity; global limits bound abuse.
    perform pg_advisory_xact_lock(20260916, 1);
    if exists (select 1 from public.site_feedback where id = p_request_id and client_id = p_client_id) then return; end if;
    if (select count(*) from public.site_feedback where client_id = p_client_id and created_at > now() - interval '10 minutes') >= 3 then
        raise exception 'You have sent several messages. Please try again in 10 minutes.';
    end if;
    if (select count(*) from public.site_feedback where created_at > now() - interval '1 hour') >= 30
       or (select count(*) from public.site_feedback where created_at > now() - interval '1 day') >= 150 then
        raise exception 'Feedback is receiving a lot of messages. Please try again later.';
    end if;
    insert into public.site_feedback(id, client_id, kind, message, email, context, screenshot)
    values (p_request_id, p_client_id, p_kind, btrim(p_message), p_email, p_context, p_screenshot);
end;
$$;
revoke all on function public.submit_site_feedback(uuid, uuid, text, text, text, jsonb, text, text) from public;
grant execute on function public.submit_site_feedback(uuid, uuid, text, text, text, jsonb, text, text) to anon, authenticated;
commit;
