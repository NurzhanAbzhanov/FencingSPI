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
        normalized_email in ('nabzhanov@ucsd.edu', 'jic330@ucsd.edu'),
        true
    )
    on conflict (id) do update
    set role = excluded.role,
        can_vote = excluded.can_vote,
        active = true;

    return new;
end;
$$;

insert into public.profiles (id, display_name, role, can_vote, active)
select
    id,
    coalesce(
        nullif(raw_user_meta_data ->> 'display_name', ''),
        split_part(lower(email), '@', 1)
    ),
    'admin'::public.app_role,
    true,
    true
from auth.users
where lower(email) in ('nabzhanov@ucsd.edu', 'jic330@ucsd.edu')
on conflict (id) do update
set role = 'admin'::public.app_role,
    can_vote = true,
    active = true;
