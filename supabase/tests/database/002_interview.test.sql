begin;

select plan(13);

select tests.create_supabase_user('interview_user_a');
select tests.create_supabase_user('interview_user_b');

select is((select count(*) from public.interview_questions), 41::bigint, '固定質問は41問(既存20問+基本プロフィール17問+開示意思4問)');
select is((select count(*) from public.interview_questions where kind = 'choice'), 36::bigint, '選択式は36問');
select is((select count(*) from public.interview_questions where kind = 'free_text'), 5::bigint, '自由記述は5問');
select ok(
  not public.interview_has_visible_text(E'\t\n' || chr(160) || chr(12288)),
  'Unicode空白だけの回答は可視文字を持たない'
);

set local role authenticated;
select tests.authenticate_as('interview_user_a');

select is(
  public.lock_current_user_journey(),
  tests.get_supabase_uid('interview_user_a'),
  'owner単位のtransaction advisory lockを取得する'
);
select throws_ok(
  $$select * from public.save_interview_answer('q02', '一人', null)$$,
  'P0001',
  'OUT_OF_ORDER',
  '最初の未回答より先の新規回答を拒否する'
);

-- 表示順1(display_order=1)は基本プロフィールq21(性別)。q01〜q20は表示順22〜41に
-- 移動しているため、この利用者にとっての「最初の質問」はq21になる。
select is(
  (select revision from public.save_interview_answer('q21', '男性', null)),
  1,
  '初回回答はrevision 1'
);
select is(
  (select revision from public.save_interview_answer('q21', '女性', 1)),
  2,
  '一致するrevisionだけ更新できる'
);
select throws_ok(
  $$select * from public.save_interview_answer('q21', 'その他・回答しない', 1)$$,
  'P0001',
  'STATE_CONFLICT',
  '古いrevisionを拒否する'
);
select throws_ok(
  $$select * from public.save_interview_answer('q20', '', null)$$,
  'P0001',
  'VALIDATION_ERROR',
  '自由記述の空文字を拒否する'
);
select throws_ok(
  $$select * from public.save_interview_answer('q20', repeat('あ', 501), null)$$,
  'P0001',
  'VALIDATION_ERROR',
  '自由記述の501文字を拒否する'
);

select tests.authenticate_as('interview_user_b');
select is(
  (select count(*) from public.interview_answers),
  0::bigint,
  '別利用者の回答はRLSで見えない'
);
select throws_ok(
  $$update public.interview_answers set answer = '日によって半々'$$,
  '42501',
  null,
  '回答表への直接更新は許可されない'
);

select * from finish();

rollback;
