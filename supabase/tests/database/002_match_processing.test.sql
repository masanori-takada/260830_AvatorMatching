begin;
select plan(11);

select tests.create_supabase_user('match_owner');
select tests.create_supabase_user('match_other');

insert into public.interview_answers(owner_id, question_code, answer)
select tests.get_supabase_uid('match_owner'), question.code,
  case when question.kind = 'choice' then question.choices ->> 0 else '安全な自由回答' end
from public.interview_questions question;
insert into public.avatar_profiles(owner_id, summary, traits, source_revision, provider)
values (
  tests.get_supabase_uid('match_owner'), '安全な要約',
  '{"leisure":"読書","communication":"傾聴","lifestyle":"安定","values":"誠実","relationships":"対話","priorities":"調和"}',
  20, 'mock-v1'
);

set local role authenticated;
select tests.authenticate_as('match_owner');
select match_run_id as run_id from public.start_match_run() \gset

select is((select status from public.match_runs where id = :'run_id'), 'queued'::public.match_status, 'runはqueuedで開始する');
select is((select match_run_id from public.start_match_run()), :'run_id'::uuid, 'startはowner単位で冪等');
select is(public.claim_match_run(:'run_id'), 'processing'::public.match_status, 'ownerがrunをclaimできる');
select is((select attempt_count from public.match_runs where id = :'run_id'), 1::smallint, 'claimでattemptが増える');
select throws_ok(
  format('select public.complete_match_run(%L, %L::jsonb)', :'run_id', '{}'),
  'P0001', 'INVALID_OUTPUT', '不正payloadを拒否する'
);
select is((select count(*) from public.compatibility_reports where match_run_id = :'run_id'), 0::bigint, '不正payloadではreportを残さない');

select public.complete_match_run(
  :'run_id',
  jsonb_build_object(
    'messages', (select jsonb_agg(jsonb_build_object(
      'turnIndex', n, 'speaker', case when n % 2 = 1 then 'user_avatar' else 'candidate_avatar' end,
      'body', '安全な発言' || n, 'answerRefs', case when n <= 3 then jsonb_build_array('q0' || n) else '[]'::jsonb end
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
  )
);

select is((select status from public.match_runs where id = :'run_id'), 'completed'::public.match_status, 'completeでcompletedになる');
select is((select count(*) from public.compatibility_reports where match_run_id = :'run_id'), 1::bigint, 'reportは1件だけ確定する');
select is((select count(*) from public.compatibility_dimensions), 5::bigint, '5軸だけ確定する');
select is((select count(*) from public.notifications where match_run_id = :'run_id'), 2::bigint, '通知を2件確定する');

select public.complete_match_run(:'run_id', '{}'::jsonb);
select is((select count(*) from public.compatibility_dimensions), 5::bigint, 'complete再実行でも5軸を維持する');

select * from finish();
rollback;
