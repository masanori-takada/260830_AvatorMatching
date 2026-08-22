begin;
select plan(21);

select tests.create_supabase_user('reset_owner');
select tests.create_supabase_user('reset_other');

-- demo_candidates.genderは202608220004_gender_matching.sqlでNOT NULLになったため、
-- テスト用の挿入にも値を与える(値そのものはこのテストの検証対象ではない)。
insert into public.demo_candidates(id, avatar_alias, gender, conversation_profile, active)
values ('00000000-0000-4000-8000-000000000098', 'ハル', 'male', '{"values":["対話"]}', true)
on conflict (id) do nothing;
insert into public.candidate_reveals(candidate_id, full_name, company, department, bio)
values ('00000000-0000-4000-8000-000000000098', '架空太郎（完全架空）', '架空リセット株式会社', '架空検証室', '完全に架空の候補者紹介です。')
on conflict (candidate_id) do nothing;

insert into public.interview_answers(owner_id, question_code, answer)
select owner.uid, question.code,
  case when question.kind = 'choice' then question.choices ->> 0 else '安全な自由回答' end
from (values
  (tests.get_supabase_uid('reset_owner')),
  (tests.get_supabase_uid('reset_other'))
) owner(uid)
cross join public.interview_questions question;

insert into public.avatar_profiles(owner_id, summary, traits, source_revision, provider)
select owner.uid, '安全な要約',
  '{"leisure":"読書","communication":"傾聴","lifestyle":"安定","values":"誠実","relationships":"対話","priorities":"調和"}',
  20, 'mock-v1'
from (values
  (tests.get_supabase_uid('reset_owner')),
  (tests.get_supabase_uid('reset_other'))
) owner(uid);

-- notifications.match_run_id はnullable(202608130003_matching.sql)。実際のINSERTはRPC経由で
-- 常にmatch_run_idを指定するが、それはスキーマが強制していない不変条件でしかない。
-- match_runsのon delete cascadeだけに頼るとこのケースを見落とすため、超権限で直接1件差し込み、
-- reset_my_demo_dataがowner_idを条件に明示的削除していることを検証する。
insert into public.notifications(owner_id, match_run_id, kind, title, body)
values (
  tests.get_supabase_uid('reset_owner'), null, 'match_completed',
  'マッチに紐づかない通知', 'match_run_idを持たない通知のテスト用データです。'
);

create function pg_temp.valid_match_payload()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'messages', (select jsonb_agg(jsonb_build_object(
      'turnIndex', n,
      'speaker', case when n % 2 = 1 then 'user_avatar' else 'candidate_avatar' end,
      'body', '安全な発言' || n,
      'answerRefs', jsonb_build_array('q0' || ((n - 1) % 3 + 1))
    ) order by n) from generate_series(1, 8) n),
    'report', jsonb_build_object(
      'overallScore', 75, 'summary', '安全な相性要約', 'caution', '違いは対話で確認します。',
      'dimensions', jsonb_build_array(
        jsonb_build_object('axis','conversation_flow','score',75,'explanation','安全な根拠','evidenceTurnIndex',1),
        jsonb_build_object('axis','values_alignment','score',74,'explanation','安全な根拠','evidenceTurnIndex',2),
        jsonb_build_object('axis','humor_fit','score',73,'explanation','安全な根拠','evidenceTurnIndex',3),
        jsonb_build_object('axis','mutual_interest','score',72,'explanation','安全な根拠','evidenceTurnIndex',4),
        jsonb_build_object('axis','mismatch_severity','score',20,'explanation','安全な根拠','evidenceTurnIndex',5)
      )
    )
  );
$$;

set local role authenticated;

select tests.authenticate_as('reset_owner');
select match_run_id as owner_run_id from public.start_match_run() \gset
select public.claim_match_run(:'owner_run_id');
select public.complete_match_run(:'owner_run_id', pg_temp.valid_match_payload());
select public.commit_decision(:'owner_run_id', 'accept');

select tests.authenticate_as('reset_other');
select match_run_id as other_run_id from public.start_match_run() \gset
select public.claim_match_run(:'other_run_id');
select public.complete_match_run(:'other_run_id', pg_temp.valid_match_payload());
select public.commit_decision(:'other_run_id', 'accept');

select ok(not has_function_privilege('anon', 'public.reset_my_demo_data()', 'EXECUTE'), 'anonはリセットRPCを実行できない');
select ok(has_function_privilege('authenticated', 'public.reset_my_demo_data()', 'EXECUTE'), 'authenticatedはリセットRPCを実行できる');

select tests.authenticate_as('reset_owner');
select is((select count(*) from public.notifications where match_run_id is null), 1::bigint, 'match_run_idがNULLの通知が準備できている');
select lives_ok('select public.reset_my_demo_data()', 'ownerは自分のデモデータをリセットできる');

select is((select count(*) from public.interview_answers), 0::bigint, '自分の回答が削除される');
select is((select count(*) from public.avatar_profiles), 0::bigint, '自分のアバタープロフィールが削除される');
select is((select count(*) from public.match_runs), 0::bigint, '自分のmatch_runが削除される');
select is((select count(*) from public.conversation_messages), 0::bigint, '会話ログもカスケード削除される');
select is((select count(*) from public.compatibility_reports), 0::bigint, '相性レポートもカスケード削除される');
select is((select count(*) from public.compatibility_dimensions), 0::bigint, '相性の軸別評価もカスケード削除される');
select is((select count(*) from public.decisions), 0::bigint, '決定もカスケード削除される');
select is((select count(*) from public.notifications), 0::bigint, '通知もカスケード削除される');
select is((select count(*) from public.notifications where match_run_id is null), 0::bigint, 'match_run_idがNULLの通知も削除される');

select lives_ok('select public.reset_my_demo_data()', '削除後の再実行もエラーにならない(冪等)');

select tests.authenticate_as('reset_other');
select is((select count(*) from public.interview_answers), 42::bigint, '別利用者の回答は消えない');
select is((select count(*) from public.avatar_profiles), 1::bigint, '別利用者のアバタープロフィールは消えない');
select is((select count(*) from public.match_runs), 1::bigint, '別利用者のmatch_runは消えない');
select is((select count(*) from public.decisions), 1::bigint, '別利用者の決定は消えない');
select is((select count(*) from public.notifications), 2::bigint, '別利用者の通知は消えない');
select is((select count(*) from public.demo_candidates where id = '00000000-0000-4000-8000-000000000098'), 1::bigint, '共有の候補データは削除されない');

reset role;
select is((select count(*) from public.candidate_reveals where candidate_id = '00000000-0000-4000-8000-000000000098'), 1::bigint, '共有の開示データは削除されない');

select * from finish();
rollback;
