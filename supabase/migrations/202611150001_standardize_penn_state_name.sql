begin;

-- Preserve school/program IDs: historical matches, ratings, and votes refer to them.
do $$
begin
    if (select count(*) from public.programs p join public.schools s on s.id=p.school_id
        where (p.legacy_team_id=26 and p.gender='Men' or p.legacy_team_id=44 and p.gender='Women')
            and s.name in ('Penn State','Pennsylvania State University'))<>2 then
        raise exception 'Unexpected Penn State program mapping; no school names changed';
    end if;
end;
$$;

update public.schools s set name='Penn State'
where s.name='Pennsylvania State University'
    and exists(select 1 from public.programs p where p.school_id=s.id and p.legacy_team_id=44 and p.gender='Women');

commit;
