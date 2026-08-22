begin;
select plan(31);

select tests.create_supabase_user('match_owner');
select tests.create_supabase_user('match_other');
select tests.create_supabase_user('stale_owner');
select tests.create_supabase_user('retry_owner');

insert into public.interview_answers(owner_id, question_code, answer)
select owner.uid, question.code,
  case when question.kind = 'choice' then question.choices ->> 0 else '安全な自由回答' end
from (values
  (tests.get_supabase_uid('match_owner')),
  (tests.get_supabase_uid('stale_owner')),
  (tests.get_supabase_uid('retry_owner'))
) owner(uid)
cross join public.interview_questions question;

-- avatar_profiles.source_revisionは「回答時点のrevision合計」を表す。
-- interview_answersの初回insertはrevision=1固定なので、41問ぶんの合計は41になる。
insert into public.avatar_profiles(owner_id, summary, traits, source_revision, provider)
select owner.uid, '安全な要約',
  '{"leisure":"読書","communication":"傾聴","lifestyle":"安定","values":"誠実","relationships":"対話","priorities":"調和"}',
  owner.source_revision, 'mock-v1'
from (values
  (tests.get_supabase_uid('match_owner'), 41),
  (tests.get_supabase_uid('stale_owner'), 40),
  (tests.get_supabase_uid('retry_owner'), 41)
) owner(uid, source_revision);

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
select tests.authenticate_as('match_owner');
select public.start_match_run();

select is((select count(*) from public.match_runs where owner_id = tests.get_supabase_uid('match_owner')), 3::bigint,
  'アクティブな候補者3人ぶんのrunが作られる');
select is((select count(*) from public.match_runs
  where owner_id = tests.get_supabase_uid('match_owner') and status = 'queued'), 3::bigint,
  '作られたrunはqueuedで始まる');

select public.start_match_run();
select is((select count(*) from public.match_runs where owner_id = tests.get_supabase_uid('match_owner')), 3::bigint,
  'startを再実行しても重複してrunが増えない(冪等)');

-- 以降の単一run向けアサーションは、ルナ(seed.sqlの固定候補)とのrunに絞って進める。
select id as run_id from public.match_runs
where owner_id = tests.get_supabase_uid('match_owner')
  and candidate_id = '00000000-0000-4000-8000-000000000001' \gset

select is(public.claim_match_run(:'run_id'), 'processing'::public.match_status, 'ownerはrunをclaimできる');
select is((select attempt_count from public.match_runs where id = :'run_id'), 1::smallint, 'claimでattemptが増える');

select tests.authenticate_as('match_other');
select throws_ok(format('select public.claim_match_run(%L)', :'run_id'), 'P0002', 'MATCH_NOT_FOUND', '他ownerはclaimできない');
select throws_ok(
  format('select public.complete_match_run(%L, %L::jsonb)', :'run_id', pg_temp.valid_match_payload()),
  'P0002', 'MATCH_NOT_FOUND', '他ownerはcompleteできない'
);

select tests.authenticate_as('match_owner');
select throws_ok(format('select public.complete_match_run(%L, %L::jsonb)', :'run_id', '{}'),
  'P0001', 'INVALID_OUTPUT', '不正payloadを拒否する');
select is((select count(*) from public.compatibility_reports where match_run_id = :'run_id'), 0::bigint,
  '不正payloadではreportを残さない');
select throws_ok(format('select public.complete_match_run(%L, %L::jsonb)', :'run_id',
  pg_temp.valid_match_payload() #- '{messages,0,answerRefs}'), 'P0001', 'INVALID_OUTPUT', 'answerRefs欠落を拒否する');
select throws_ok(format('select public.complete_match_run(%L, %L::jsonb)', :'run_id',
  jsonb_set(pg_temp.valid_match_payload(), '{messages,0,answerRefs}', 'null')), 'P0001', 'INVALID_OUTPUT', 'answerRefs nullを拒否する');
select throws_ok(format('select public.complete_match_run(%L, %L::jsonb)', :'run_id',
  jsonb_set(pg_temp.valid_match_payload(), '{messages,0,answerRefs}', '"q01"')), 'P0001', 'INVALID_OUTPUT', 'answerRefs非arrayを拒否する');
select throws_ok(format('select public.complete_match_run(%L, %L::jsonb)', :'run_id',
  jsonb_set(pg_temp.valid_match_payload(), '{messages,0,answerRefs}', '[]')), 'P0001', 'INVALID_OUTPUT', '空answerRefsを拒否する');
select is((select count(*) from public.conversation_messages where match_run_id = :'run_id'), 0::bigint,
  '検証失敗時は部分書込を残さない');

select public.complete_match_run(:'run_id', pg_temp.valid_match_payload());
select is((select status from public.match_runs where id = :'run_id'), 'completed'::public.match_status, 'completeでcompletedになる');
select is((select count(*) from public.compatibility_reports where match_run_id = :'run_id'), 1::bigint, 'reportは1件だけ確定する');
select is((select count(*) from public.compatibility_dimensions where owner_id = tests.get_supabase_uid('match_owner')), 5::bigint, '5軸だけ確定する');
select is((select count(*) from public.notifications where match_run_id = :'run_id'), 2::bigint, '通知2件を確定する');
select public.complete_match_run(:'run_id', '{}'::jsonb);
select is((select count(*) from public.compatibility_dimensions where owner_id = tests.get_supabase_uid('match_owner')), 5::bigint, 'complete再実行でも5軸を維持する');

select ok(
  not has_function_privilege('anon', 'public.mark_notification_read(uuid)', 'EXECUTE'),
  'anonは既読RPCを実行できない'
);
select ok(
  has_function_privilege('authenticated', 'public.mark_notification_read(uuid)', 'EXECUTE'),
  'authenticatedは既読RPCを実行できる'
);
select id as notification_id from public.notifications where match_run_id = :'run_id' order by kind limit 1 \gset
select public.mark_notification_read(:'notification_id') as first_read_at \gset
select isnt(:'first_read_at'::timestamptz, null::timestamptz, 'ownerは通知を既読にできる');
select is(public.mark_notification_read(:'notification_id'), :'first_read_at'::timestamptz, '既読再実行は同じ時刻を返す');
select tests.authenticate_as('match_other');
select throws_ok(
  format('select public.mark_notification_read(%L)', :'notification_id'),
  'P0002', 'NOTIFICATION_NOT_FOUND', '他ownerは通知を既読にできない'
);

select tests.authenticate_as('stale_owner');
select throws_ok('select public.start_match_run()', 'P0001', 'STALE_PROFILE', '古いプロフィールでは開始しない');
select is((select count(*) from public.match_runs where owner_id = tests.get_supabase_uid('stale_owner')), 0::bigint,
  '古いプロフィールではrunを作らない');

select tests.authenticate_as('retry_owner');
select public.start_match_run();
select is((select count(*) from public.match_runs where owner_id = tests.get_supabase_uid('retry_owner')), 3::bigint,
  '再試行用ownerでも3件のrunを開始する');
select id as retry_run_id from public.match_runs
where owner_id = tests.get_supabase_uid('retry_owner')
  and candidate_id = '00000000-0000-4000-8000-000000000001' \gset
select is((select status from public.match_runs where id = :'retry_run_id'), 'queued'::public.match_status, '再試行用runはqueuedで始まる');
select public.claim_match_run(:'retry_run_id');
select public.fail_match_run(:'retry_run_id', 'PROVIDER_ERROR');
select public.claim_match_run(:'retry_run_id');
select public.fail_match_run(:'retry_run_id', 'TIMEOUT');
select public.claim_match_run(:'retry_run_id');
select public.fail_match_run(:'retry_run_id', 'INTERNAL_ERROR');
select is((select status from public.match_runs where id = :'retry_run_id'), 'failed'::public.match_status, '3回失敗後はfailedになる');
select is((select attempt_count from public.match_runs where id = :'retry_run_id'), 3::smallint, 'attemptは3で上限になる');
select throws_ok(format('select public.claim_match_run(%L)', :'retry_run_id'), 'P0001', 'RETRY_LIMIT', '4回目のclaimを拒否する');

select * from finish();
rollback;
