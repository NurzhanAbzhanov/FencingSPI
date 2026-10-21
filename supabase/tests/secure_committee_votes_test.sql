begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email) values
('a1000000-0000-4000-8000-000000000001','vote-admin@example.com'),
('a1000000-0000-4000-8000-000000000002','vote-a@example.com'),
('a1000000-0000-4000-8000-000000000003','vote-b@example.com'),
('a1000000-0000-4000-8000-000000000004','vote-observer@example.com');
insert into public.profiles(id,display_name,role,active,can_vote) select id,'Security fixture',
    case when email='vote-admin@example.com' then 'admin'::public.app_role else 'coach'::public.app_role end,true,true
    from auth.users where email like 'vote-%@example.com'
    on conflict(id) do update set role=excluded.role,active=true,can_vote=true;
insert into public.committee_access_grants(email,display_name,role,active,can_vote)
    select email,'Security fixture',case when email='vote-admin@example.com' then 'admin'::public.app_role else 'coach'::public.app_role end,true,true
    from auth.users where email in ('vote-admin@example.com','vote-a@example.com','vote-b@example.com');
insert into public.seasons(id,slug,name,starts_on,ends_on) values
('a2000000-0000-4000-8000-000000000001','security-fixture','Security fixture','2026-08-01','2027-07-31');
insert into public.poll_periods(id,season_id,month,label,status) values
('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',10,'Security fixture','open');
insert into public.schools(id,name) select 910000+i,'Security school '||i from generate_series(1,15) i;
insert into public.programs(school_id,legacy_team_id,gender) select 910000+i,910000+i,'Men' from generate_series(1,15) i;
insert into public.program_seasons(season_id,program_id,division) select 'a2000000-0000-4000-8000-000000000001',id,
    case when legacy_team_id <= 910008 then 3 else 1 end from public.programs where legacy_team_id between 910001 and 910015;

set local role anon;
select throws_ok('select * from public.votes','42501','permission denied for table votes','Anonymous visitors cannot read votes');
select throws_ok($$delete from public.votes$$,'42501','permission denied for table votes','Anonymous visitors cannot delete votes');
select throws_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','men_team_overall',array[910001]::bigint[],false)$$,
    '42501','permission denied for function save_committee_vote','Anonymous visitors cannot call the voting RPC');

reset role;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select lives_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','men_team_overall',array[910001]::bigint[],false)$$,'Member can save a partial draft');
select is((select status from public.votes where voter_id=auth.uid()),'draft','Draft is stored');
select throws_ok($$insert into public.votes(poll_id,voter_id,category,rankings,status) values('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','men_team_overall','[910001]','draft')$$,
    'P0001','Voting access required','Member cannot impersonate another voter');
select throws_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','men_team_overall',array[910001,910001]::bigint[],false)$$,
    'P0001','Ballot rankings must be unique','Server rejects duplicate rankings');
select throws_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','women_team_overall',array[910001]::bigint[],false)$$,
    'P0001','Ballot contains ineligible teams','Server validates gender');
select throws_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','men_team_overall',array[910001]::bigint[],true)$$,
    'P0001','Ballot requires 15 ranked teams','Submission needs all ranks');
select throws_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','men_team_diii',array[910001]::bigint[],false)$$,
    'P0001','Submit the overall ballot first','DIII requires a submitted overall ballot');
select lives_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','men_team_overall',array(select generate_series(910001,910015))::bigint[],true)$$,'Member submits a complete ballot');
select throws_ok($$update public.votes set status='draft' where voter_id=auth.uid()$$,
    'P0001','Submitted ballots are locked. Ask an administrator to reset it.','Direct API cannot unlock a submission');
select lives_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','men_team_diii',array(select generate_series(910001,910008))::bigint[],true)$$,'DIII preserves overall order');
select lives_ok($$update public.poll_periods set status='closed' where id='a3000000-0000-4000-8000-000000000001'$$,'Nonadmin schedule update is filtered by RLS');
-- Updates blocked by RLS affect zero rows, rather than raising an exception.
reset role;
select is((select status::text from public.poll_periods where id='a3000000-0000-4000-8000-000000000001'),'open','Member cannot change the poll schedule');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((select count(*)::integer from public.votes),2,'Other committee members can see submitted ballots before closing');
select lives_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','men_team_overall',array[910002]::bigint[],false)$$,'Second member can save their own draft');
select is((select count(*)::integer from public.votes),3,'Member sees submitted ballots and their own draft while open');
select is((select count(*)::integer from public.votes where status='draft' and voter_id<>auth.uid()),0,'Other voters drafts remain private');
reset role;
update public.poll_periods set status='closed' where id='a3000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from public.votes),3,'Committee sees submitted votes after closing and its own draft');
select throws_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','men_team_overall',array[910003]::bigint[],false)$$,
    'P0001','This poll is not open','Cannot edit a draft after closing');
reset role;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
set local role authenticated;
select is((select count(*)::integer from public.votes),0,'Noncommittee accounts cannot see closed individual votes');
select throws_ok($$select public.save_committee_vote('a3000000-0000-4000-8000-000000000001','men_team_overall',array[910003]::bigint[],false)$$,
    'P0001','Voting access required','Noncommittee accounts cannot vote');
reset role;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*)::integer from public.votes),3,'Admin can inspect all votes');
reset role;
update public.poll_periods set status='open' where id='a3000000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.reset_committee_vote((select id from public.votes where voter_id='a1000000-0000-4000-8000-000000000002' and category='men_team_overall'))$$,'Admin can reset a test ballot');
select is((select count(*)::integer from public.votes where voter_id='a1000000-0000-4000-8000-000000000002'),0,'Reset clears the dependent DIII ballot too');
select * from finish();
rollback;
