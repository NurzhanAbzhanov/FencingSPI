begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
delete from public.site_feedback;
insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feedback-admin@example.com');
insert into public.profiles(id, display_name, role, active) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Feedback admin', 'admin', true)
on conflict (id) do update set role='admin', active=true;

set local role anon;
select lives_ok($$select public.submit_site_feedback('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'problem', 'Test feedback message', null, '{"pageUrl":"https://usfca.org/#/spi","season":"2025-26"}')$$, 'Anonymous visitors can submit');
select lives_ok($$select public.submit_site_feedback('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'problem', 'Test feedback message', null, '{"pageUrl":"https://usfca.org/#/spi","season":"2025-26"}')$$, 'Retry is idempotent');
select throws_ok('select * from public.site_feedback', '42501', 'permission denied for table site_feedback', 'Anonymous users cannot read messages or attachments');
select throws_ok($$insert into public.site_feedback(id) values(gen_random_uuid())$$, '42501', 'permission denied for table site_feedback', 'Cannot bypass RPC with direct INSERT');
select throws_ok($$select public.submit_site_feedback(gen_random_uuid(), gen_random_uuid(), 'problem', ' ', null, '{"pageUrl":"https://usfca.org","season":"2025-26"}')$$, 'P0001', 'Feedback must be between 10 and 4000 characters.', 'Server rejects empty feedback');
select throws_ok($$select public.submit_site_feedback(gen_random_uuid(), gen_random_uuid(), 'problem', 'Test feedback message', null, '{"pageUrl":"https://usfca.org","season":"2025-26"}', 'data:image/svg+xml;base64,AAA')$$, 'P0001', 'Invalid screenshot. Please choose another image.', 'Rejects active image formats');
select lives_ok($$select public.submit_site_feedback(gen_random_uuid(), gen_random_uuid(), 'problem', 'Bot feedback message', null, '{"pageUrl":"https://usfca.org","season":"2025-26"}', null, 'spam')$$, 'Honeypot silently discards automated submissions');
reset role;
select is((select count(*)::int from public.site_feedback), 1, 'No duplicates or honeypot rows stored');

set local role authenticated;
select is((select count(*)::int from public.site_feedback), 0, 'Authenticated non-admins cannot read feedback');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select is((select count(*)::int from public.site_feedback), 1, 'Active admins can read feedback');
select lives_ok($$update public.site_feedback set status='in_progress'$$, 'Admins can triage feedback');
select is((select status from public.site_feedback limit 1), 'in_progress', 'Status change persists');
select throws_ok($$update public.site_feedback set message='changed message'$$, '42501', 'permission denied for table site_feedback', 'Admins cannot rewrite submitted feedback');
reset role;

select public.submit_site_feedback(gen_random_uuid(), '22222222-2222-4222-8222-222222222222', 'other', 'Another useful message', null, '{"pageUrl":"https://usfca.org","season":"2025-26"}');
select public.submit_site_feedback(gen_random_uuid(), '22222222-2222-4222-8222-222222222222', 'other', 'Another useful message', null, '{"pageUrl":"https://usfca.org","season":"2025-26"}');
select throws_ok($$select public.submit_site_feedback(gen_random_uuid(), '22222222-2222-4222-8222-222222222222', 'other', 'Another useful message', null, '{"pageUrl":"https://usfca.org","season":"2025-26"}')$$, 'P0001', 'You have sent several messages. Please try again in 10 minutes.', 'Enforces client throttle');
insert into public.site_feedback(id, client_id, kind, message, context)
select gen_random_uuid(), gen_random_uuid(), 'other', 'Global rate limit fixture', '{}'::jsonb from generate_series(1,27);
select throws_ok($$select public.submit_site_feedback(gen_random_uuid(), gen_random_uuid(), 'other', 'Another useful message', null, '{"pageUrl":"https://usfca.org","season":"2025-26"}')$$, 'P0001', 'Feedback is receiving a lot of messages. Please try again later.', 'Global throttle protects against rotating client IDs');
select * from finish();
rollback;
