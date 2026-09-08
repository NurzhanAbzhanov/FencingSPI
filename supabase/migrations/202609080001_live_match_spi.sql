-- Transactional counterpart of src/lib/spi.ts. Match writes and SPI publish together.
create or replace function public.recalculate_season_spi(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    perform 1 from public.seasons where id = target for update;
    if not found then raise exception 'Season not found'; end if;
    if exists (
        select 1 from public.spi_results where season_id = target and calculation_method = 'imported'
    ) then raise exception 'This season contains imported SPI. Supply and validate its ratings before recalculating.'; end if;
    if exists (
        select 1 from public.matches m
        cross join lateral (values (m.left_program_id), (m.right_program_id)) p(id)
        cross join unnest(enum_range(null::public.fencing_weapon)) w(weapon)
        left join public.spi_results r on r.season_id = target and r.program_id = p.id and r.weapon = w.weapon
        left join public.power_rating_overrides o on o.season_id = target and o.program_id = p.id and o.weapon = w.weapon
        where m.season_id = target and coalesce(o.adjusted_power_rating, r.power_rating) is null
    ) then raise exception 'Missing season power ratings. Calculate or assign all squad and team ratings before saving matches.'; end if;

    with ratings as (
        select r.program_id, r.weapon, coalesce(o.adjusted_power_rating, r.power_rating) pr
        from public.spi_results r
        left join public.power_rating_overrides o using (season_id, program_id, weapon)
        where r.season_id = target and coalesce(o.adjusted_power_rating, r.power_rating) is not null
    ), scores as (
        select m.left_program_id l, m.right_program_id r, w.weapon::public.fencing_weapon weapon, w.a, w.b
        from public.matches m
        cross join lateral (values
            ('Epee', m.left_epee, m.right_epee), ('Foil', m.left_foil, m.right_foil),
            ('Sabre', m.left_sabre, m.right_sabre),
            ('Team', m.left_epee+m.left_foil+m.left_sabre, m.right_epee+m.right_foil+m.right_sabre)
        ) w(weapon,a,b)
        where m.season_id = target and (w.weapon = 'Team' or w.a <> w.b)
    ), results as (
        select s.weapon, side.program_id, side.win, pr.pr,
            case when pr.pr >= 80 then 'H' when pr.pr >= 50 then 'M' else 'L' end category
        from scores s
        cross join lateral (values (s.l, s.r, (s.a>s.b)::integer), (s.r, s.l, (s.b>=s.a)::integer)) side(program_id,opponent,win)
        join ratings pr on pr.program_id = side.opponent and pr.weapon = s.weapon
    ), stats as (
        select r.program_id, r.weapon, r.pr,
            count(*) filter(where x.category='L')::numeric ln,
            count(*) filter(where x.category='M')::numeric mn,
            count(*) filter(where x.category='H')::numeric hn,
            coalesce(sum(x.win) filter(where x.category='L'),0)::numeric lw,
            coalesce(sum(x.win) filter(where x.category='M'),0)::numeric mw,
            coalesce(sum(x.win) filter(where x.category='H'),0)::numeric hw,
            coalesce(avg(x.pr) filter(where x.category='H')-30,0) hs,
            90+coalesce(sum(case x.pr when 20 then 27 when 30 then 30 when 40 then 33 else 0 end) filter(where x.category='L'),0) ls,
            80+coalesce(sum(case x.pr when 50 then 36 when 60 then 40 when 70 then 44 else 0 end) filter(where x.category='M'),0) ms
        from ratings r left join results x using(program_id,weapon)
        group by r.program_id,r.weapon,r.pr
    ), percentages as (
        select *, hw/(hn+2) hp, greatest((mw+1)/(mn+2), hw/(hn+2)) mp,
            greatest((lw+2)/(ln+3),(mw+1)/(mn+2),hw/(hn+2)) lp
        from stats
    )
    update public.spi_results r set
        spi = p.pr*0.05 + p.hs*p.hp
            + case when p.mw+p.hw=0 then 0 else p.ms/(p.mn+2)*p.mp end
            + case when p.lw+p.mw+p.hw=0 then 0 else p.ls/(p.ln+3)*p.lp end,
        calculated_at = now(), calculation_method = 'calculated', source_file = null
    from percentages p
    where r.season_id=target and r.program_id=p.program_id and r.weapon=p.weapon;
end;
$$;
revoke all on function public.recalculate_season_spi(uuid) from public, anon, authenticated;

create or replace function public.lock_match_season() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if TG_OP = 'UPDATE' and old.season_id <> new.season_id then
        raise exception 'To move a match, delete it from its old season and enter it in the correct season.';
    end if;
    perform 1 from public.seasons where id = case when TG_OP='DELETE' then old.season_id else new.season_id end for update;
    if TG_OP <> 'DELETE' then
        if not exists (select 1 from public.seasons where id=new.season_id and new.fenced_on between starts_on and ends_on) then
            raise exception 'Competition date is outside the selected season.';
        end if;
        if new.left_program_id = new.right_program_id or
           (select count(*) from public.programs p join public.program_seasons ps on ps.program_id=p.id
            where ps.season_id=new.season_id and p.id in (new.left_program_id,new.right_program_id) and p.gender=new.gender) <> 2 then
            raise exception 'Both teams must belong to the selected season and gender.';
        end if;
    end if;
    if TG_OP='DELETE' then return old; end if;
    return new;
end;
$$;
create or replace function public.refresh_match_spi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    perform public.recalculate_season_spi(case when TG_OP='DELETE' then old.season_id else new.season_id end);
    return null;
end;
$$;
revoke all on function public.lock_match_season() from public, anon, authenticated;
revoke all on function public.refresh_match_spi() from public, anon, authenticated;
create trigger lock_match_season before insert or update or delete on public.matches
for each row execute function public.lock_match_season();
create trigger refresh_match_spi after insert or update or delete on public.matches
for each row execute function public.refresh_match_spi();
