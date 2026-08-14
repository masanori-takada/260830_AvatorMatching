begin;

select plan(6);

insert into public.demo_candidates (id, avatar_alias, conversation_profile, active)
values
  ('10000000-0000-4000-8000-000000000001', '公開候補', '{"interests":["読書"]}', true),
  ('10000000-0000-4000-8000-000000000002', '非公開候補', '{"interests":["料理"]}', false);

insert into public.candidate_reveals (candidate_id, full_name, company, department, bio)
values (
  '10000000-0000-4000-8000-000000000001',
  '試験用架空名',
  '試験用架空会社',
  '試験用架空部署',
  '試験用の完全架空プロフィールです。'
);

select ok(
  has_table_privilege('authenticated', 'public.demo_candidates', 'select'),
  'authenticatedは匿名候補をSELECTできる'
);
select ok(
  not has_table_privilege('anon', 'public.demo_candidates', 'select'),
  'anonは匿名候補をSELECTできない'
);
select ok(
  not has_table_privilege('authenticated', 'public.candidate_reveals', 'select'),
  'authenticatedは開示情報を直接SELECTできない'
);
select ok(
  not has_table_privilege('anon', 'public.candidate_reveals', 'select'),
  'anonは開示情報を直接SELECTできない'
);

select tests.create_supabase_user('candidate_reader');
set local role authenticated;
select tests.authenticate_as('candidate_reader');

select is(
  (select count(*) from public.demo_candidates where id in (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002'
  )),
  1::bigint,
  'activeな候補だけが見える'
);
select is(
  (select avatar_alias from public.demo_candidates where id = '10000000-0000-4000-8000-000000000001'),
  '公開候補',
  '承諾前に匿名表示名だけを取得できる'
);

select * from finish();

rollback;
