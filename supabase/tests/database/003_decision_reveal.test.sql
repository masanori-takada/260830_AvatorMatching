begin;
select plan(20);

select tests.create_supabase_user('decision_owner');
select tests.create_supabase_user('decision_other');
select tests.create_supabase_user('decline_owner');

insert into public.demo_candidates(id, avatar_alias, conversation_profile, active)
values ('00000000-0000-4000-8000-000000000099', 'ソラ', '{"values":["対話"]}', true)
on conflict (id) do nothing;
insert into public.candidate_reveals(candidate_id, full_name, company, department, bio)
values ('00000000-0000-4000-8000-000000000099', '星野みなと（完全架空）', '架空株式会社ルーメン', '架空企画室', '完全に架空の候補者紹介です。')
on conflict (candidate_id) do nothing;

insert into public.match_runs(owner_id, candidate_id, status, provider, completed_at)
values
  (tests.get_supabase_uid('decision_owner'), '00000000-0000-4000-8000-000000000099', 'completed', 'mock-v1', now()),
  (tests.get_supabase_uid('decision_other'), '00000000-0000-4000-8000-000000000099', 'completed', 'mock-v1', now()),
  (tests.get_supabase_uid('decline_owner'), '00000000-0000-4000-8000-000000000099', 'completed', 'mock-v1', now());

select id as owner_run_id from public.match_runs where owner_id = tests.get_supabase_uid('decision_owner') \gset
select id as other_run_id from public.match_runs where owner_id = tests.get_supabase_uid('decision_other') \gset
select id as decline_run_id from public.match_runs where owner_id = tests.get_supabase_uid('decline_owner') \gset

select ok(not has_function_privilege('anon', 'public.commit_decision(uuid,public.decision_kind)', 'EXECUTE'), 'anonは決定RPCを実行できない');
select ok(not has_function_privilege('anon', 'public.get_candidate_reveal(uuid)', 'EXECUTE'), 'anonは開示RPCを実行できない');
select ok(has_function_privilege('authenticated', 'public.commit_decision(uuid,public.decision_kind)', 'EXECUTE'), 'authenticatedは決定RPCを実行できる');
select ok(has_function_privilege('authenticated', 'public.get_candidate_reveal(uuid)', 'EXECUTE'), 'authenticatedは開示RPCを実行できる');

set local role authenticated;
select tests.authenticate_as('decision_owner');
select throws_ok('select * from public.candidate_reveals', '42501', null, '開示テーブルを直接SELECTできない');
select is((select count(*) from public.get_candidate_reveal(:'owner_run_id')), 0::bigint, '未決定では開示0件');

select tests.authenticate_as('decision_other');
select is((select count(*) from public.get_candidate_reveal(:'owner_run_id')), 0::bigint, '別ownerには開示0件');
select throws_ok(format('select public.commit_decision(%L, %L)', :'owner_run_id', 'accept'), 'P0002', 'MATCH_NOT_FOUND', '別ownerは決定できない');

select tests.authenticate_as('decision_owner');
select (public.commit_decision(:'owner_run_id', 'accept')).id as decision_id \gset
select is((select kind from public.decisions where match_run_id = :'owner_run_id'), 'accept'::public.decision_kind, 'ownerは承諾を確定できる');
select is((select count(*) from public.decisions where match_run_id = :'owner_run_id'), 1::bigint, '決定は1件だけ');
select is((public.commit_decision(:'owner_run_id', 'accept')).id, :'decision_id'::uuid, '同じ決定の再実行は冪等');
select is((select count(*) from public.get_candidate_reveal(:'owner_run_id')), 1::bigint, '承諾後は開示1件');
select is((select full_name from public.get_candidate_reveal(:'owner_run_id')), '星野みなと（完全架空）', '固定列の氏名を返す');
select throws_ok(format('select public.commit_decision(%L, %L)', :'owner_run_id', 'decline'), 'P0001', 'DECISION_CONFLICT:accept', 'opposite retryは競合');
select throws_ok(format('insert into public.decisions(owner_id, match_run_id, kind) values (%L, %L, %L)', tests.get_supabase_uid('decision_owner'), :'owner_run_id', 'accept'), '42501', null, '直接INSERTできない');
select throws_ok(format('update public.decisions set kind = %L where match_run_id = %L', 'decline', :'owner_run_id'), '42501', null, '直接UPDATEできない');

select tests.authenticate_as('decline_owner');
select is((select count(*) from public.get_candidate_reveal(:'decline_run_id')), 0::bigint, '辞退前も開示0件');
select public.commit_decision(:'decline_run_id', 'decline');
select is((select kind from public.decisions where match_run_id = :'decline_run_id'), 'decline'::public.decision_kind, '辞退を確定できる');
select is((select count(*) from public.get_candidate_reveal(:'decline_run_id')), 0::bigint, '辞退後も開示0件');
select is((select count(*) from public.decisions where owner_id = tests.get_supabase_uid('decline_owner')), 1::bigint, '辞退も一度だけ保存する');

select * from finish();
rollback;
