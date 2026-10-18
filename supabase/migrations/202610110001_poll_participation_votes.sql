begin;

-- Participation must use the deployed votes schema, not the retired ballot tables.
create or replace function public.list_poll_participation(target_period uuid)
returns table(voter_id uuid, voter_name text, email text, definition_slug text, ballot_status text)
language plpgsql stable security definer set search_path = '' as $$
begin
    if public.current_app_role() is distinct from 'admin' then
        raise exception 'Administrator access required';
    end if;
    return query
    select p.id, g.display_name, g.email, category.slug, coalesce(v.status, 'not_started')
    from public.committee_access_grants g
    join auth.users u on lower(btrim(u.email)) = g.email
    join public.profiles p on p.id = u.id and p.active and p.can_vote
    cross join (values
        ('men_team_overall'), ('women_team_overall'),
        ('men_team_diii'), ('women_team_diii'),
        ('men_squad_epee_overall'), ('women_squad_epee_overall'),
        ('men_squad_foil_overall'), ('women_squad_foil_overall'),
        ('men_squad_sabre_overall'), ('women_squad_sabre_overall')
    ) category(slug)
    left join lateral (
        select vote.status from public.votes vote
        where vote.poll_id = target_period::text and vote.voter_id = p.id
          and (vote.category = category.slug or
            (category.slug like '%_squad_%' and vote.category = regexp_replace(category.slug, '_overall$', '')))
        order by (vote.status = 'submitted') desc, vote.updated_at desc
        limit 1
    ) v on true
    where g.active and g.can_vote
      and exists (select 1 from public.poll_periods period where period.id = target_period)
    order by lower(g.display_name), category.slug;
end;
$$;

revoke all on function public.list_poll_participation(uuid) from public, anon;
grant execute on function public.list_poll_participation(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
