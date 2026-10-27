begin;
do $$
declare target uuid;
begin
    select p.id into target from public.poll_periods p join public.seasons s on s.id=p.season_id
        where s.slug='2026-27' and p.month=10 and p.status='published';
    if target is null then raise exception 'October is not published'; end if;
    if (select count(distinct (gender,weapon,scope)) from public.archived_poll_results where poll_period_id=target)<>10 then
        raise exception 'All ten ballot categories must be published';
    end if;
    if exists (
        with expected as (
            select category,count(*) ballots from public.votes where poll_id=target::text and status='submitted' group by category
        ), actual as (
            select lower(gender::text)||'_'||case when weapon='Team' then 'team' else 'squad_'||lower(weapon::text) end||'_'||lower(scope::text) category,
                sum(points) points,sum(first_place_votes) firsts
            from public.archived_poll_results where poll_period_id=target group by gender,weapon,scope
        ) select 1 from expected e full join actual a using(category)
        where a.points is distinct from e.ballots*(case when e.category like '%_diii' then 36 else 120 end)
           or a.firsts is distinct from e.ballots
    ) then raise exception 'Published totals do not match submitted ballots'; end if;
    if exists (select 1 from (
        select rank,rank() over (partition by gender,weapon,scope order by points desc) expected
        from public.archived_poll_results where poll_period_id=target
    ) r where rank<>expected) then raise exception 'Published ties or ranks are incorrect'; end if;
    if exists (
        with expected as (
            select v.category,r.team_id::bigint team_id,
                sum((case when v.category like '%_diii' then 8 else 15 end)-r.position+1) points,
                count(*) filter (where r.position=1) firsts
            from public.votes v cross join lateral jsonb_array_elements_text(v.rankings) with ordinality r(team_id,position)
            where v.poll_id=target::text and v.status='submitted' group by v.category,r.team_id
        ), actual as (
            select lower(gender::text)||'_'||case when weapon='Team' then 'team' else 'squad_'||lower(weapon::text) end||'_'||lower(scope::text) category,
                team_id,points,first_place_votes firsts from public.archived_poll_results where poll_period_id=target
        ) select 1 from expected e full join actual a using(category,team_id)
        where e.points is distinct from a.points or e.firsts is distinct from a.firsts
    ) then raise exception 'Individual school publication totals are incorrect'; end if;
    perform set_config('role','anon',true);
    if not exists (select 1 from public.archived_poll_results where poll_period_id=target) then
        raise exception 'The public cannot read the published results';
    end if;
    if has_table_privilege('anon','public.votes','SELECT') then raise exception 'Individual ballots were exposed'; end if;
end;
$$;
rollback;
