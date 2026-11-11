begin;

alter table public.fencer_ratings alter column power_rating drop not null;
alter table public.spi_results alter column spi drop not null;
alter table public.spi_results add column included_results integer not null default 0 check (included_results>=0),
    add column excluded_results integer not null default 0 check (excluded_results>=0),
    add column is_provisional boolean not null default false;
-- Preserve the validated historical empty-result convention; use partial mode going forward.
alter table public.seasons add column allow_partial_ratings boolean not null default false;
update public.seasons s set allow_partial_ratings=true where is_active or not exists(select 1 from public.spi_results r where r.season_id=s.id);
alter table public.seasons alter column allow_partial_ratings set default true;

create or replace function public.recalculate_season_spi(target uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare partial_mode boolean;
begin
    select allow_partial_ratings into partial_mode from public.seasons where id=target for update;
    if not found then raise exception 'Season not found'; end if;
    if exists (select 1 from public.spi_results where season_id=target and calculation_method='imported') then
        raise exception 'This season contains imported SPI. Supply and validate its ratings before recalculating.';
    end if;
    if not partial_mode and exists (
        select 1 from public.matches m
        cross join lateral (values (m.left_program_id),(m.right_program_id)) p(id)
        cross join unnest(enum_range(null::public.fencing_weapon)) w(weapon)
        left join public.spi_results r on r.season_id=target and r.program_id=p.id and r.weapon=w.weapon
        left join public.power_rating_overrides o on o.season_id=target and o.program_id=p.id and o.weapon=w.weapon
        where m.season_id=target and coalesce(o.adjusted_power_rating,r.power_rating) is null
    ) then raise exception 'Missing season power ratings.'; end if;

    if partial_mode then
        insert into public.spi_results(season_id,program_id,weapon,spi,power_rating,calculation_method)
        select target,ps.program_id,w.weapon,null,null,'calculated'
        from public.program_seasons ps cross join unnest(enum_range(null::public.fencing_weapon)) w(weapon)
        where ps.season_id=target on conflict(season_id,program_id,weapon) do nothing;
    end if;

    with ratings as (
        select r.program_id,r.weapon,coalesce(o.adjusted_power_rating,r.power_rating) pr
        from public.spi_results r left join public.power_rating_overrides o using(season_id,program_id,weapon)
        where r.season_id=target
    ), scores as (
        select m.left_program_id l,m.right_program_id r,w.weapon::public.fencing_weapon weapon,w.a,w.b
        from public.matches m cross join lateral (values
            ('Epee',m.left_epee,m.right_epee),('Foil',m.left_foil,m.right_foil),('Sabre',m.left_sabre,m.right_sabre),
            ('Team',m.left_epee+m.left_foil+m.left_sabre,m.right_epee+m.right_foil+m.right_sabre)
        ) w(weapon,a,b)
        where m.season_id=target and (w.weapon='Team' or w.a<>w.b)
    ), results as (
        select s.weapon,side.program_id,side.win,opponent.pr,
            own.pr is not null and opponent.pr is not null eligible,
            case when opponent.pr>=80 then 'H' when opponent.pr>=50 then 'M' else 'L' end category
        from scores s
        cross join lateral (values (s.l,s.r,(s.a>s.b)::integer),(s.r,s.l,(s.b>=s.a)::integer)) side(program_id,opponent,win)
        join ratings own on own.program_id=side.program_id and own.weapon=s.weapon
        join ratings opponent on opponent.program_id=side.opponent and opponent.weapon=s.weapon
    ), stats as (
        select r.program_id,r.weapon,r.pr,
            count(*) filter(where x.eligible)::integer included,
            count(*) filter(where x.eligible=false)::integer excluded,
            count(*) filter(where x.eligible and x.category='L')::numeric ln,
            count(*) filter(where x.eligible and x.category='M')::numeric mn,
            count(*) filter(where x.eligible and x.category='H')::numeric hn,
            coalesce(sum(x.win) filter(where x.eligible and x.category='L'),0)::numeric lw,
            coalesce(sum(x.win) filter(where x.eligible and x.category='M'),0)::numeric mw,
            coalesce(sum(x.win) filter(where x.eligible and x.category='H'),0)::numeric hw,
            coalesce(avg(x.pr) filter(where x.eligible and x.category='H')-30,0) hs,
            90+coalesce(sum(case x.pr when 20 then 27 when 30 then 30 when 40 then 33 else 0 end) filter(where x.eligible and x.category='L'),0) ls,
            80+coalesce(sum(case x.pr when 50 then 36 when 60 then 40 when 70 then 44 else 0 end) filter(where x.eligible and x.category='M'),0) ms
        from ratings r left join results x using(program_id,weapon) group by r.program_id,r.weapon,r.pr
    ), percentages as (
        select *,hw/(hn+2) hp,greatest((mw+1)/(mn+2),hw/(hn+2)) mp,
            greatest((lw+2)/(ln+3),(mw+1)/(mn+2),hw/(hn+2)) lp from stats
    )
    update public.spi_results r set
        spi=case when p.pr is null or (partial_mode and p.included=0) then null else
            p.pr*0.05+p.hs*p.hp
            +case when p.mw+p.hw=0 then 0 else p.ms/(p.mn+2)*p.mp end
            +case when p.lw+p.mw+p.hw=0 then 0 else p.ls/(p.ln+3)*p.lp end end,
        included_results=p.included,excluded_results=p.excluded,
        is_provisional=partial_mode and (p.pr is null or p.included=0 or p.excluded>0),
        calculated_at=now(),calculation_method='calculated',source_file=null
    from percentages p where r.season_id=target and r.program_id=p.program_id and r.weapon=p.weapon;
end;
$$;
revoke all on function public.recalculate_season_spi(uuid) from public,anon,authenticated;

create or replace function public.replace_fencer_ratings_and_recalculate(
    p_season_slug text,p_gender public.fencing_gender,p_rows jsonb,p_source_file text
) returns void language plpgsql security definer set search_path = '' as $$
declare target uuid; invalid_team text;
begin
    if public.current_app_role() is distinct from 'admin' then raise exception 'Admin access required'; end if;
    select id into target from public.seasons where slug=btrim(p_season_slug) for update;
    if target is null then raise exception 'Unknown season: %',p_season_slug; end if;
    if exists(select 1 from public.spi_results where season_id=target and calculation_method='imported') then
        raise exception 'Imported SPI seasons cannot be recalculated from partial rosters.';
    end if;
    if p_gender is null then raise exception 'Gender is required'; end if;
    if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then
        raise exception 'At least one fencer rating row is required'; end if;
    if nullif(btrim(p_source_file),'') is null then raise exception 'Source filename is required'; end if;
    if exists (select 1 from jsonb_to_recordset(p_rows) r(team_name text,weapon text,power_rating numeric)
        where nullif(btrim(r.team_name),'') is null or r.weapon is null or r.weapon not in ('Epee','Foil','Sabre')
            or r.power_rating<0 or r.power_rating::text in ('NaN','Infinity','-Infinity')) then
        raise exception 'Uploaded fencer rating rows are invalid'; end if;
    select r.team_name into invalid_team from jsonb_to_recordset(p_rows) r(team_name text,weapon text,power_rating numeric)
    where not exists(select 1 from public.programs p join public.schools s on s.id=p.school_id
        join public.program_seasons ps on ps.program_id=p.id and ps.season_id=target
        where p.gender=p_gender and (lower(btrim(s.name))=lower(btrim(r.team_name))
            or (lower(btrim(s.name))='penn state' and lower(btrim(r.team_name))='pennsylvania state university'))) limit 1;
    if invalid_team is not null then raise exception 'Could not find % program for team: %',p_gender,invalid_team; end if;

    delete from public.fencer_ratings r using public.programs p where r.season_id=target and r.program_id=p.id and p.gender=p_gender;
    insert into public.fencer_ratings(season_id,program_id,weapon,power_rating,source_file,imported_by)
    select target,p.id,r.weapon::public.fencing_weapon,r.power_rating,btrim(p_source_file),auth.uid()
    from jsonb_to_recordset(p_rows) r(team_name text,weapon text,power_rating numeric)
    join public.schools s on lower(btrim(s.name))=lower(btrim(r.team_name))
        or (lower(btrim(s.name))='penn state' and lower(btrim(r.team_name))='pennsylvania state university')
    join public.programs p on p.school_id=s.id and p.gender=p_gender
    join public.program_seasons ps on ps.program_id=p.id and ps.season_id=target;
    update public.seasons set allow_partial_ratings=true where id=target;

    with ranked as (
        select f.*,row_number() over(partition by f.program_id,f.weapon order by f.power_rating desc nulls last,f.id) position
        from public.fencer_ratings f join public.programs p on p.id=f.program_id and p.gender=p_gender where f.season_id=target
    ), raw as (
        select program_id,weapon,case when count(*)>=3 and count(power_rating)=count(*)
            then sum(power_rating) filter(where position<=3)/3.0 end raw_rating
        from ranked group by program_id,weapon
    ), squads as (
        select ps.program_id,p.gender,w.weapon,raw.raw_rating
        from public.program_seasons ps join public.programs p on p.id=ps.program_id and p.gender=p_gender
        cross join (values ('Epee'::public.fencing_weapon),('Foil'::public.fencing_weapon),('Sabre'::public.fencing_weapon)) w(weapon)
        left join raw on raw.program_id=ps.program_id and raw.weapon=w.weapon where ps.season_id=target
    ), all_ratings as (
        select * from squads union all
        select program_id,gender,'Team'::public.fencing_weapon,case when count(raw_rating)=3 then avg(raw_rating) end
        from squads group by program_id,gender
    )
    insert into public.spi_results(season_id,program_id,weapon,spi,power_rating,calculation_method)
    select target,program_id,weapon,null,
        case when raw_rating is null then null when raw_rating=0 then 0 when raw_rating<10 then 10
            when gender='Men' then floor(raw_rating/10)*10 else ceil(raw_rating/10)*10 end,'calculated'
    from all_ratings where true on conflict(season_id,program_id,weapon) do update
        set power_rating=excluded.power_rating,spi=null,calculated_at=now();
    perform public.recalculate_season_spi(target);
end;
$$;
revoke all on function public.replace_fencer_ratings_and_recalculate(text,public.fencing_gender,jsonb,text) from public,anon;
grant execute on function public.replace_fencer_ratings_and_recalculate(text,public.fencing_gender,jsonb,text) to authenticated;

create or replace function public.refresh_override_spi() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
    if TG_OP='UPDATE' and old.season_id<>new.season_id then
        raise exception 'Delete the override and recreate it to move it to another season.';
    end if;
    target:=case when TG_OP='DELETE' then old.season_id else new.season_id end;
    if not exists(select 1 from public.spi_results where season_id=target and calculation_method='imported') then
        perform public.recalculate_season_spi(target);
    end if;
    return null;
end;
$$;
revoke all on function public.refresh_override_spi() from public,anon,authenticated;
create trigger refresh_override_spi after insert or update or delete on public.power_rating_overrides
    for each row execute function public.refresh_override_spi();

create or replace view public.public_spi_standings with (security_invoker=false) as
select s.slug season_slug,p.legacy_team_id team_id,school.name team_name,p.gender,r.weapon,r.spi,
    r.included_results,r.excluded_results,r.is_provisional,s.allow_partial_ratings coverage_tracked
from public.spi_results r join public.seasons s on s.id=r.season_id
join public.programs p on p.id=r.program_id join public.schools school on school.id=p.school_id;
grant select on public.public_spi_standings to anon,authenticated;
notify pgrst,'reload schema';
commit;
