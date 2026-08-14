begin;

select plan(10);

select tests.create_supabase_user('interview_user_a');
select tests.create_supabase_user('interview_user_b');

select is((select count(*) from public.interview_questions), 20::bigint, '固定質問は20問');
select is((select count(*) from public.interview_questions where kind = 'choice'), 15::bigint, '選択式は15問');
select is((select count(*) from public.interview_questions where kind = 'free_text'), 5::bigint, '自由記述は5問');

set local role authenticated;
select tests.authenticate_as('interview_user_a');

select is(
  (select revision from public.save_interview_answer('q01', '外へ出かける', null)),
  1,
  '初回回答はrevision 1'
);
select is(
  (select revision from public.save_interview_answer('q01', '家でゆっくりする', 1)),
  2,
  '一致するrevisionだけ更新できる'
);
select throws_ok(
  $$select * from public.save_interview_answer('q01', '日によって半々', 1)$$,
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
