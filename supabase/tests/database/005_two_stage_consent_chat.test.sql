begin;
select plan(46);

select tests.create_supabase_user('consent_owner');
select tests.create_supabase_user('consent_other');
select tests.create_supabase_user('closed_owner');
select tests.create_supabase_user('null_contact_owner');
select tests.create_supabase_user('legacy_accept_owner');
select tests.create_supabase_user('existing_connection_owner');

select ok(not has_function_privilege('anon', 'public.commit_contact_decision(uuid,public.decision_kind)', 'EXECUTE'), 'anonは最終承認RPCを実行できない');
select ok(not has_function_privilege('anon', 'public.send_chat_message(uuid,text)', 'EXECUTE'), 'anonはチャット送信RPCを実行できない');
select ok(has_function_privilege('authenticated', 'public.commit_contact_decision(uuid,public.decision_kind)', 'EXECUTE'), 'authenticatedは最終承認RPCを実行できる');
select ok(has_function_privilege('authenticated', 'public.send_chat_message(uuid,text)', 'EXECUTE'), 'authenticatedはチャット送信RPCを実行できる');
select is(
  public.anonymize_pre_consent_text('ルナ・陽翔・紬・蒼太・隼人・芽衣との会話'),
  '候補アバター・候補アバター・候補アバター・候補アバター・候補アバター・候補アバターとの会話',
  '承認前表示の6候補名だけを匿名化する'
);
select is(public.anonymize_pre_consent_text('候補と自然に会話できました'), '候補と自然に会話できました', '候補名を含まない通常文は変更しない');
select is((select count(*) from public.chat_messages), 0::bigint, '接続前のchat messageはownerに表示されない');

insert into public.match_runs(owner_id, candidate_id, status, provider, completed_at)
values
  (tests.get_supabase_uid('consent_owner'), '00000000-0000-4000-8000-000000000001', 'completed', 'mock-v1', now()),
  (tests.get_supabase_uid('consent_owner'), '00000000-0000-4000-8000-000000000002', 'completed', 'mock-v1', now()),
  (tests.get_supabase_uid('consent_other'), '00000000-0000-4000-8000-000000000001', 'completed', 'mock-v1', now()),
  (tests.get_supabase_uid('closed_owner'), '00000000-0000-4000-8000-000000000001', 'completed', 'mock-v1', now()),
  (tests.get_supabase_uid('closed_owner'), '00000000-0000-4000-8000-000000000002', 'completed', 'mock-v1', now()),
  (tests.get_supabase_uid('null_contact_owner'), '00000000-0000-4000-8000-000000000003', 'completed', 'mock-v1', now()),
  (tests.get_supabase_uid('legacy_accept_owner'), '00000000-0000-4000-8000-000000000004', 'completed', 'mock-v1', now()),
  (tests.get_supabase_uid('existing_connection_owner'), '00000000-0000-4000-8000-000000000005', 'completed', 'mock-v1', now());

select id as owner_run_id from public.match_runs
  where owner_id = tests.get_supabase_uid('consent_owner') and candidate_id = '00000000-0000-4000-8000-000000000001' \gset
select id as owner_second_run_id from public.match_runs
  where owner_id = tests.get_supabase_uid('consent_owner') and candidate_id = '00000000-0000-4000-8000-000000000002' \gset
select id as other_run_id from public.match_runs
  where owner_id = tests.get_supabase_uid('consent_other') \gset
select id as closed_run_id from public.match_runs
  where owner_id = tests.get_supabase_uid('closed_owner') and candidate_id = '00000000-0000-4000-8000-000000000001' \gset
select id as closed_second_run_id from public.match_runs
  where owner_id = tests.get_supabase_uid('closed_owner') and candidate_id = '00000000-0000-4000-8000-000000000002' \gset
select id as null_contact_run_id from public.match_runs
  where owner_id = tests.get_supabase_uid('null_contact_owner') \gset
select id as legacy_accept_run_id from public.match_runs
  where owner_id = tests.get_supabase_uid('legacy_accept_owner') \gset
select id as existing_connection_run_id from public.match_runs
  where owner_id = tests.get_supabase_uid('existing_connection_owner') \gset

insert into public.decisions(owner_id, match_run_id, kind, decided_at)
values
  (tests.get_supabase_uid('legacy_accept_owner'), :'legacy_accept_run_id', 'accept', '2026-08-01 12:34:56+00'),
  (tests.get_supabase_uid('existing_connection_owner'), :'existing_connection_run_id', 'accept', '2026-08-02 12:34:56+00');
insert into public.match_connections(owner_id, match_run_id, state, contact_decision, profile_revealed_at, connected_at)
values (
  tests.get_supabase_uid('existing_connection_owner'),
  :'existing_connection_run_id',
  'connected',
  'accept',
  '2026-08-03 12:34:56+00',
  '2026-08-03 12:34:56+00'
);
select public.backfill_accepted_match_connections();
select is((select state from public.match_connections where match_run_id = :'legacy_accept_run_id'), 'profile_revealed'::public.match_connection_state, '旧acceptをprofile_revealed connectionへbackfillする');
select is((select profile_revealed_at from public.match_connections where match_run_id = :'legacy_accept_run_id'), '2026-08-01 12:34:56+00'::timestamptz, '旧acceptのdecided_atをprofile_revealed_atへ保持する');
select is((select state from public.match_connections where match_run_id = :'existing_connection_run_id'), 'connected'::public.match_connection_state, '既存connectionのstateを上書きしない');
select is((select profile_revealed_at from public.match_connections where match_run_id = :'existing_connection_run_id'), '2026-08-03 12:34:56+00'::timestamptz, '既存connectionの時刻を上書きしない');

set local role authenticated;
select tests.authenticate_as('null_contact_owner');
select (public.commit_decision(:'null_contact_run_id', 'accept')).id as null_contact_decision_id \gset
select throws_ok(
  format('select public.commit_contact_decision(%L, null)', (select id from public.match_connections where match_run_id = :'null_contact_run_id')),
  'P0001',
  'INVALID_CONTACT_DECISION',
  '最終判断NULLを専用エラーで拒否する'
);
select is((select state from public.match_connections where match_run_id = :'null_contact_run_id'), 'profile_revealed'::public.match_connection_state, 'NULL拒否後もconnection stateを変更しない');
select is((select count(*) from public.chat_messages where owner_id = tests.get_supabase_uid('null_contact_owner')), 0::bigint, 'NULL拒否後に固定挨拶を作成しない');
select is((select count(*) from public.notifications where owner_id = tests.get_supabase_uid('null_contact_owner')), 0::bigint, 'NULL拒否後に通知を作成しない');

set local role authenticated;
select tests.authenticate_as('consent_owner');
select is((select count(*) from public.get_candidate_reveal(:'owner_run_id')), 0::bigint, '1回目の決定前は開示されない');
select (public.commit_decision(:'owner_run_id', 'accept')).id as decision_id \gset
select is((select state from public.match_connections where match_run_id = :'owner_run_id'), 'profile_revealed'::public.match_connection_state, '1回目の承認でプロフィール開示状態になる');
select is((select count(*) from public.get_candidate_reveal(:'owner_run_id')), 1::bigint, '1回目の相互承認後に開示される');
select is((select first_name from public.get_candidate_reveal(:'owner_run_id')), 'ルナ', '下の名前だけ返す');
select is((select age_range from public.get_candidate_reveal(:'owner_run_id')), '30代前半', '年齢層を返す');
select is((select is_ai_generated from public.get_candidate_reveal(:'owner_run_id')), true, '架空AI画像フラグを返す');
select is((select photo_path from public.get_candidate_reveal(:'owner_run_id')), '/images/demo-candidates/luna.webp', '固定画像パスを返す');
select throws_ok(format('select public.commit_decision(%L, %L)', :'owner_second_run_id', 'accept'), 'P0001', 'ACTIVE_CONNECTION_EXISTS', 'アクティブな候補がある間は別候補を承認できない');
select is((select count(*) from public.decisions where match_run_id = :'owner_second_run_id'), 0::bigint, '競合した候補に決定を残さない');

select id as owner_connection_id from public.match_connections where match_run_id = :'owner_run_id' \gset
select (public.commit_contact_decision(:'owner_connection_id', 'accept')).state as connected_state \gset
select is(:'connected_state', 'connected'::public.match_connection_state, '最終承認でconnectedになる');
select is((select count(*) from public.chat_messages where connection_id = :'owner_connection_id' and sender = 'candidate'), 1::bigint, '候補の固定挨拶を1通だけ挿入する');
select public.send_chat_message(:'owner_connection_id', ' こんにちは  ') as message_id \gset
select is((select body from public.chat_messages where id = :'message_id'), 'こんにちは', '利用者メッセージをtrimして保存する');
select is((select count(*) from public.notifications where owner_id = tests.get_supabase_uid('consent_owner') and kind = 'contact_ready'), 1::bigint, '接続時にcontact_ready通知を作成する');
select is((select count(*) from public.chat_messages where connection_id = :'owner_connection_id'), 2::bigint, 'チャットは候補挨拶と利用者発言だけを保持する');
select throws_ok(format('insert into public.chat_messages(owner_id, connection_id, sender, body) values (%L, %L, %L, %L)',
  tests.get_supabase_uid('consent_owner'), :'owner_connection_id', 'candidate', '直接挿入'),
  '42501', null, 'authenticatedは候補senderの直接INSERTを実行できない');
select throws_ok(format('select public.send_chat_message(%L, %L)', :'owner_connection_id', ''), 'P0001', 'INVALID_MESSAGE', '空メッセージを拒否する');
select throws_ok(format('select public.send_chat_message(%L, %L)', :'owner_connection_id', E'\n\t\r'), 'P0001', 'INVALID_MESSAGE', '改行とタブだけのメッセージを拒否する');
select throws_ok(format('select public.send_chat_message(%L, %L)', :'owner_connection_id', chr(160) || chr(8239) || chr(12288)), 'P0001', 'INVALID_MESSAGE', 'Unicode空白だけのメッセージを拒否する');
select throws_ok(format('select public.send_chat_message(%L, repeat(%L, 1001))', :'owner_connection_id', 'x'), 'P0001', 'INVALID_MESSAGE', '1000文字超のメッセージを拒否する');

select tests.authenticate_as('consent_other');
select is((select count(*) from public.chat_messages where connection_id = :'owner_connection_id'), 0::bigint, '別ownerには既存メッセージをSELECTさせない');
select throws_ok(format('select public.send_chat_message(%L, %L)', :'owner_connection_id', 'なりすまし'), 'P0001', 'CHAT_NOT_CONNECTED', '別ownerは他人の接続へ送信できない');
select is((select count(*) from public.chat_messages where body = 'なりすまし'), 0::bigint, 'なりすまし発言を保存しない');
select is((select count(*) from public.get_candidate_reveal(:'owner_run_id')), 0::bigint, '別ownerには開示されない');

select tests.authenticate_as('closed_owner');
select (public.commit_decision(:'closed_run_id', 'accept')).id as closed_decision_id \gset
select (public.commit_contact_decision((select id from public.match_connections where match_run_id = :'closed_run_id'), 'decline')).state as closed_state \gset
select is(:'closed_state', 'closed'::public.match_connection_state, '最終見送りでconnectionをclosedにする');
select (public.commit_decision(:'closed_second_run_id', 'accept')).id as second_decision_id \gset
select is((select state from public.match_connections where match_run_id = :'closed_second_run_id'), 'profile_revealed'::public.match_connection_state, 'closed後は別候補を承認できる');

select tests.authenticate_as('consent_owner');
select lives_ok('select public.reset_my_demo_data()', '接続済みownerはデモデータをリセットできる');
select is((select count(*) from public.match_connections where owner_id = tests.get_supabase_uid('consent_owner')), 0::bigint, 'resetでconnectionを削除する');
select is((select count(*) from public.chat_messages where owner_id = tests.get_supabase_uid('consent_owner')), 0::bigint, 'resetでchat messageを削除する');
select is((select count(*) from public.notifications where owner_id = tests.get_supabase_uid('consent_owner')), 0::bigint, 'resetで通知を削除する');
select is((select count(*) from public.demo_candidates where id in (
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006'
)), 6::bigint, 'resetで候補者マスタを保持する');

select is((select count(*) from public.candidate_reveals where first_name is not null and age_range is not null and interests is not null and photo_path is not null and is_ai_generated), 6::bigint, '6候補の開示プロフィールが揃っている');

select * from finish();
rollback;
