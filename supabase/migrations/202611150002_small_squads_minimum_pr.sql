begin;

create or replace function public.recalculate_season_power_ratings(target uuid, p_gender public.fencing_gender default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
    perform 1 from public.seasons where id=target for update;
    if not found then raise exception 'Season not found'; end if;
    if exists(select 1 from public.spi_results where season_id=target and calculation_method='imported') then
        raise exception 'Imported SPI seasons cannot be recalculated from partial rosters.';
    end if;
    with ranked as (
        select f.*,row_number() over(partition by f.program_id,f.weapon order by f.power_rating desc nulls last,f.id) position
        from public.fencer_ratings f join public.programs p on p.id=f.program_id
        where f.season_id=target and (p_gender is null or p.gender=p_gender)
    ), raw as (
        select program_id,weapon,case when count(power_rating)=count(*)
            then avg(power_rating) filter(where position<=3) end raw_rating
        from ranked group by program_id,weapon
    ), squads as (
        select ps.program_id,p.gender,w.weapon,
            case when exists(select 1 from public.fencer_ratings missing
                where missing.season_id=target and missing.program_id=ps.program_id and missing.weapon is null)
                then null else raw.raw_rating end raw_rating
        from public.program_seasons ps join public.programs p on p.id=ps.program_id
        cross join (values ('Epee'::public.fencing_weapon),('Foil'::public.fencing_weapon),('Sabre'::public.fencing_weapon)) w(weapon)
        left join raw on raw.program_id=ps.program_id and raw.weapon=w.weapon
        where ps.season_id=target and (p_gender is null or p.gender=p_gender)
    ), all_ratings as (
        select * from squads union all
        select program_id,gender,'Team'::public.fencing_weapon,case when count(raw_rating)=3 then avg(raw_rating) end
        from squads group by program_id,gender
    )
    insert into public.spi_results(season_id,program_id,weapon,spi,power_rating,calculation_method)
    select target,program_id,weapon,null,
        case when raw_rating is null then null else greatest(20,
            case when gender='Men' then floor(raw_rating/10)*10 else ceil(raw_rating/10)*10 end) end,'calculated'
    from all_ratings where true on conflict(season_id,program_id,weapon) do update
        set power_rating=excluded.power_rating,spi=null,calculated_at=now();
    perform public.recalculate_season_spi(target);
end;
$$;
-- Only the existing admin-checked upload function and database owner may invoke this helper.
revoke all on function public.recalculate_season_power_ratings(uuid,public.fencing_gender) from public,anon,authenticated;

do $migration$
declare definition text; start_at integer; end_at integer;
begin
    select pg_get_functiondef('public.replace_fencer_ratings_and_recalculate(text,public.fencing_gender,jsonb,text)'::regprocedure) into definition;
    start_at:=strpos(definition,'    with ranked as (');
    end_at:=strpos(definition,'    perform public.recalculate_season_spi(target);');
    if start_at=0 or end_at<=start_at then raise exception 'Unexpected PR upload function; no patch applied'; end if;
    definition:=substr(definition,1,start_at-1)
        || '    perform public.recalculate_season_power_ratings(target,p_gender);'
        || substr(definition,end_at+length('    perform public.recalculate_season_spi(target);'));
    execute definition;
end;
$migration$;

alter table public.power_rating_overrides add constraint power_rating_overrides_minimum_20 check(adjusted_power_rating>=20);

-- Recalculate only the requested current season, preserving roster rows and historical seasons.
do $$
declare target uuid;
begin
    select id into target from public.seasons where slug='2026-27';
    if target is not null then perform public.recalculate_season_power_ratings(target); end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
