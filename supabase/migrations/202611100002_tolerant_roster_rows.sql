begin;

-- An unassigned weapon is retained to prevent treating an incomplete roster as complete.
alter table public.fencer_ratings alter column weapon drop not null;

do $migration$
declare
    definition text;
    old_validation text := 'or r.weapon is null or r.weapon not in';
    old_squads text := 'select ps.program_id,p.gender,w.weapon,raw.raw_rating';
begin
    select pg_get_functiondef('public.replace_fencer_ratings_and_recalculate(text,public.fencing_gender,jsonb,text)'::regprocedure)
    into definition;
    if strpos(definition, old_validation)=0 or strpos(definition, old_squads)=0 then
        raise exception 'Unexpected PR function definition; tolerant-roster patch was not applied';
    end if;
    definition := replace(definition, old_validation, 'or r.weapon not in');
    definition := replace(definition, old_squads, $replacement$
        select ps.program_id,p.gender,w.weapon,
            case when exists (
                select 1 from public.fencer_ratings missing
                where missing.season_id=target and missing.program_id=ps.program_id
                    and missing.weapon is null
            ) then null else raw.raw_rating end as raw_rating
    $replacement$);
    execute definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
