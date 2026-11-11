begin;
insert into auth.users(id,email) values('b1000000-0000-4000-8000-000000000001','partial-admin@example.com');
insert into public.profiles(id,display_name,role,active,can_vote)
values('b1000000-0000-4000-8000-000000000001','Partial fixture','admin',true,false)
on conflict(id) do update set role='admin',active=true;
insert into public.seasons(id,slug,name,starts_on,ends_on)
values('b2000000-0000-4000-8000-000000000001','partial-fixture','Partial fixture','2026-08-01','2027-07-31');
insert into public.schools(id,name) values(920001,'Partial A'),(920002,'Partial B'),(920003,'Partial C');
insert into public.programs(id,school_id,legacy_team_id,gender) values
('b3000000-0000-4000-8000-000000000001',920001,920001,'Men'),
('b3000000-0000-4000-8000-000000000002',920002,920002,'Men'),
('b3000000-0000-4000-8000-000000000003',920003,920003,'Men');
insert into public.program_seasons(season_id,program_id,division)
select 'b2000000-0000-4000-8000-000000000001',id,1 from public.programs where school_id between 920001 and 920003;
insert into public.matches(season_id,fenced_on,gender,left_program_id,right_program_id,left_epee,left_foil,left_sabre,right_epee,right_foil,right_sabre,host)
values('b2000000-0000-4000-8000-000000000001','2026-11-01','Men','b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002',6,6,6,3,3,3,'Test');

do $$
declare roster jsonb; completed jsonb; two_fencers jsonb; women jsonb; row_count integer; denied boolean:=false;
    target uuid:='b2000000-0000-4000-8000-000000000001';
    a uuid:='b3000000-0000-4000-8000-000000000001';
    b uuid:='b3000000-0000-4000-8000-000000000002';
begin
    if exists(select 1 from public.spi_results where season_id=target and spi is not null) then
        raise exception 'Matches without ratings must be stored without SPI'; end if;
    perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
    select jsonb_agg(jsonb_build_object('team_name',school,'weapon',weapon,'power_rating',rating)) into roster
    from (select school,weapon,case when school='Partial A' and weapon='Epee' then 100
        when school='Partial A' and n<=2 then 90 else rating end rating
        from (values ('Partial A',80),('Partial B',60)) s(school,rating)
        cross join (values ('Epee'),('Foil'),('Sabre')) w(weapon) cross join generate_series(1,3) n
        union all select 'Partial A','Epee',null) data;
    perform public.replace_fencer_ratings_and_recalculate('partial-fixture','Men',roster,'partial.xlsx');
    if (select power_rating from public.spi_results where season_id=target and program_id=a and weapon='Epee') is not null then
        raise exception 'Three rated fencers cannot hide an unrated roster member'; end if;
    if (select power_rating from public.spi_results where season_id=target and program_id=a and weapon='Team') is not null then
        raise exception 'Team PR requires three complete squads'; end if;
    if (select power_rating from public.spi_results where season_id=target and program_id=a and weapon='Foil') is distinct from 80 then
        raise exception 'Complete squad power rating is incorrect'; end if;
    if (select included_results from public.spi_results where season_id=target and program_id=a and weapon='Foil')<>1 then
        raise exception 'Complete weapon pairing was excluded'; end if;
    if (select excluded_results from public.spi_results where season_id=target and program_id=b and weapon='Epee')<>1
        or (select spi from public.spi_results where season_id=target and program_id=b and weapon='Epee') is not null then
        raise exception 'An unavailable opponent must be excluded symmetrically, without PRC-only SPI'; end if;

    insert into public.power_rating_overrides(season_id,program_id,weapon,adjusted_power_rating,reason,updated_by)
    values(target,a,'Epee',100,'Verified manual rating','b1000000-0000-4000-8000-000000000001');
    if (select included_results from public.spi_results where season_id=target and program_id=b and weapon='Epee')<>1 then
        raise exception 'Explicit manual ratings must make results eligible'; end if;
    delete from public.power_rating_overrides where season_id=target and program_id=a;
    if (select spi from public.spi_results where season_id=target and program_id=b and weapon='Epee') is not null then
        raise exception 'Removing the manual rating must exclude affected results again'; end if;

    insert into public.matches(season_id,fenced_on,gender,left_program_id,right_program_id,left_epee,left_foil,left_sabre,right_epee,right_foil,right_sabre,host)
    values(target,'2026-11-02','Men',a,'b3000000-0000-4000-8000-000000000003',6,6,6,3,3,3,'Test');
    if not exists(select 1 from public.spi_results where season_id=target and program_id=a and weapon='Foil'
        and included_results=1 and excluded_results=1 and is_provisional and spi is not null) then
        raise exception 'Partial SPI needs included/excluded coverage'; end if;
    select jsonb_agg(case when elem->'power_rating'='null'::jsonb then jsonb_set(elem,'{power_rating}','40') else elem end)
        into completed from jsonb_array_elements(roster) elem;
    perform public.replace_fencer_ratings_and_recalculate('partial-fixture','Men',completed,'complete-a.xlsx');
    if (select power_rating from public.spi_results where season_id=target and program_id=a and weapon='Team') is distinct from 90
        or (select included_results from public.spi_results where season_id=target and program_id=a and weapon='Team')<>1 then
        raise exception 'Late ratings must enable Team PR from raw squad averages and previously excluded matches'; end if;
    select completed || jsonb_agg(jsonb_build_object('team_name','Partial C','weapon',weapon,'power_rating',0)) into two_fencers
        from (values ('Epee'),('Foil'),('Sabre')) w(weapon) cross join lateral generate_series(1,case when weapon='Epee' then 2 else 3 end);
    perform public.replace_fencer_ratings_and_recalculate('partial-fixture','Men',two_fencers,'two-fencers.xlsx');
    if (select power_rating from public.spi_results where season_id=target and program_id='b3000000-0000-4000-8000-000000000003' and weapon='Epee') is not null then
        raise exception 'Squads with fewer than three fencers must be excluded'; end if;
    select completed || jsonb_agg(jsonb_build_object('team_name','Partial C','weapon',weapon,'power_rating',0)) into completed
        from (values ('Epee'),('Foil'),('Sabre')) w(weapon) cross join generate_series(1,3);
    perform public.replace_fencer_ratings_and_recalculate('partial-fixture','Men',completed,'complete-all.xlsx');
    if exists(select 1 from public.spi_results where season_id=target and (spi is null or excluded_results<>0 or is_provisional)) then
        raise exception 'Finishing rosters must restore all eligible results, including real zero PR'; end if;
    if (select power_rating from public.spi_results where season_id=target and program_id='b3000000-0000-4000-8000-000000000003' and weapon='Team') is distinct from 0 then
        raise exception 'Genuine zero must not become unknown or ten'; end if;
    select count(*) into row_count from public.matches where season_id=target;
    if row_count<>2 then raise exception 'No match should be deleted during rating recalculation'; end if;
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
    begin
        perform public.replace_fencer_ratings_and_recalculate('partial-fixture','Men',completed,'unauthorized.xlsx');
    exception when raise_exception then
        if sqlerrm<>'Admin access required' then raise; end if;
        denied:=true;
    end;
    if not denied then raise exception 'Nonadmins must not replace ratings'; end if;
    perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
    insert into public.programs(id,school_id,legacy_team_id,gender)
        values('b3000000-0000-4000-8000-000000000004',920001,920004,'Women');
    insert into public.program_seasons(season_id,program_id,division)
        values(target,'b3000000-0000-4000-8000-000000000004',1);
    select jsonb_agg(jsonb_build_object('team_name','Partial A','weapon',weapon,'power_rating',case when n=1 then 10 else 20 end)) into women
        from (values ('Epee'),('Foil'),('Sabre')) w(weapon) cross join generate_series(1,3) n;
    perform public.replace_fencer_ratings_and_recalculate('partial-fixture','Women',women,'women.xlsx');
    if (select power_rating from public.spi_results where season_id=target and program_id='b3000000-0000-4000-8000-000000000004' and weapon='Team') is distinct from 20
        or (select power_rating from public.spi_results where season_id=target and program_id=a and weapon='Team') is distinct from 90 then
        raise exception 'Women must round up without changing mens ratings'; end if;
end;
$$;
rollback;
