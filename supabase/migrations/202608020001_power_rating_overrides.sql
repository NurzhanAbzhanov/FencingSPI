create table public.power_rating_overrides (
    id uuid primary key default gen_random_uuid(),
    season_id uuid not null references public.seasons(id) on delete cascade,
    program_id uuid not null references public.programs(id) on delete cascade,
    weapon public.fencing_weapon not null,
    adjusted_power_rating numeric not null check (adjusted_power_rating >= 0),
    reason text not null check (length(trim(reason)) > 0),
    updated_by uuid not null references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (season_id, program_id, weapon)
);

alter table public.power_rating_overrides enable row level security;

create policy "Admins read power rating overrides"
on public.power_rating_overrides for select
using (public.current_app_role() = 'admin');

create policy "Admins manage power rating overrides"
on public.power_rating_overrides for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');
