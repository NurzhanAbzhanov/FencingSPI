begin;

-- Change only the size constants, preserving the audited ownership/locking rules.
-- Fail rather than patch an unexpected function definition from another deployment.
do $$
declare definition text;
    old_limit text := 'rank_limit := case when is_d3 then 8 else 15 end;';
    old_men text := $old$('men_team_diii','Men','Team','DIII',8)$old$;
    old_women text := $old$('women_team_diii','Women','Team','DIII',8)$old$;
begin
    definition := pg_get_functiondef('public.enforce_committee_vote()'::regprocedure);
    if strpos(definition,old_limit)=0 then raise exception 'Unexpected vote validator definition'; end if;
    execute replace(definition,old_limit,'rank_limit := case when is_d3 then 10 else 15 end;');

    definition := pg_get_functiondef('public.publish_poll_period(uuid)'::regprocedure);
    if strpos(definition,old_men)=0 or strpos(definition,old_women)=0 then
        raise exception 'Unexpected poll publisher definition';
    end if;
    definition := replace(definition,old_men,$new$('men_team_diii','Men','Team','DIII',10)$new$);
    definition := replace(definition,old_women,$new$('women_team_diii','Women','Team','DIII',10)$new$);
    execute definition;
end;
$$;

-- No existing votes or frozen publications are rewritten.
notify pgrst, 'reload schema';
commit;
