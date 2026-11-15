begin;
do $$
begin
    if (select count(*) from public.programs p join public.schools s on s.id=p.school_id
        where p.legacy_team_id in (26,44) and s.name='Penn State')<>2 then
        raise exception 'Both Penn State programs must use the canonical school name';
    end if;
    if (select count(distinct s.name) from public.programs p join public.schools s on s.id=p.school_id
        where p.legacy_team_id in (26,44))<>1 then
        raise exception 'Penn State must contribute only one host option';
    end if;
    if not exists(select 1 from public.programs where legacy_team_id=26 and gender='Men')
        or not exists(select 1 from public.programs where legacy_team_id=44 and gender='Women') then
        raise exception 'Separate historical program IDs must be preserved';
    end if;
end;
$$;
rollback;
