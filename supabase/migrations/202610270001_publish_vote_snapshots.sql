begin;

-- Reuse the public publication store for frozen current-season results too.
alter table public.archived_poll_results drop constraint archived_poll_results_period_check;
alter table public.archived_poll_results add constraint archived_poll_results_period_check
    check (period in ('Preseason','Midseason','End-season','October','November','December','January'));
alter table public.archived_poll_results
    add column poll_period_id uuid references public.poll_periods(id),
    add column first_place_votes integer check (first_place_votes >= 0);
create index archived_poll_results_period_idx on public.archived_poll_results(poll_period_id);

create or replace function public.publish_poll_period(target_period uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
    period public.poll_periods%rowtype;
    season_slug_value text;
    month_label text;
    result_count integer;
begin
    if public.current_app_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
    select * into period from public.poll_periods where id = target_period for update;
    if not found then raise exception 'Poll period not found'; end if;
    if period.status <> 'closed' then raise exception 'Poll period must be closed before publishing'; end if;
    if not exists (select 1 from public.votes where poll_id = target_period::text and status = 'submitted') then
        raise exception 'There are no submitted ballots to publish';
    end if;
    select slug into season_slug_value from public.seasons where id = period.season_id;
    month_label := case period.month when 10 then 'October' when 11 then 'November'
        when 12 then 'December' when 1 then 'January' end;
    if month_label is null then raise exception 'Unsupported poll month'; end if;

    delete from public.archived_poll_results where poll_period_id = target_period;
    insert into public.archived_poll_results
        (season_slug,team_id,gender,weapon,scope,period,rank,points,source_url,poll_period_id,first_place_votes)
    with categories(slug,gender,weapon,scope,slots) as (values
        ('men_team_overall','Men','Team','Overall',15), ('women_team_overall','Women','Team','Overall',15),
        ('men_team_diii','Men','Team','DIII',8), ('women_team_diii','Women','Team','DIII',8),
        ('men_squad_epee_overall','Men','Epee','Overall',15), ('women_squad_epee_overall','Women','Epee','Overall',15),
        ('men_squad_foil_overall','Men','Foil','Overall',15), ('women_squad_foil_overall','Women','Foil','Overall',15),
        ('men_squad_sabre_overall','Men','Sabre','Overall',15), ('women_squad_sabre_overall','Women','Sabre','Overall',15)
    ), submitted as (
        select distinct on (v.voter_id,c.slug) v.rankings,c.*
        from public.votes v join categories c on v.category = c.slug
            or (c.slug like '%_squad_%' and v.category = regexp_replace(c.slug,'_overall$',''))
        where v.poll_id = target_period::text and v.status = 'submitted'
        order by v.voter_id,c.slug,v.updated_at desc
    ), totals as (
        select s.slug,s.gender,s.weapon,s.scope,p.legacy_team_id,
            sum(s.slots - r.position + 1)::integer points,
            count(*) filter (where r.position = 1)::integer firsts
        from submitted s cross join lateral jsonb_array_elements_text(s.rankings) with ordinality r(team_id,position)
        join public.programs p on p.legacy_team_id = r.team_id::bigint and p.gender::text = s.gender
        where r.position <= s.slots
        group by s.slug,s.gender,s.weapon,s.scope,p.legacy_team_id
    )
    select season_slug_value,legacy_team_id,gender::public.fencing_gender,weapon::public.fencing_weapon,
        scope::public.poll_scope,month_label,
        rank() over (partition by slug order by points desc)::integer,points,
        'https://usfca.org/spi-project/#/polls/public/' || target_period::text,target_period,firsts
    from totals;
    get diagnostics result_count = row_count;
    if result_count = 0 then raise exception 'No eligible rankings were found'; end if;
    update public.poll_periods set status = 'published' where id = target_period;
    insert into public.poll_admin_audit_log(period_id,actor_id,action,detail)
        values(target_period,auth.uid(),'published',jsonb_build_object('result_rows',result_count,'source','votes'));
end;
$$;
revoke all on function public.publish_poll_period(uuid) from public, anon;
grant execute on function public.publish_poll_period(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
