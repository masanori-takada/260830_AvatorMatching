begin;

select plan(8);

select tests.create_supabase_user('profile_user_a');
select tests.create_supabase_user('profile_user_b');

select has_column('public', 'avatar_profiles', 'source_revision', 'source_revision列がある');
select is(
  has_function_privilege(
    'anon',
    'public.upsert_my_avatar_profile(text,jsonb,integer,text)',
    'EXECUTE'
  ),
  false,
  'anonはavatar profile RPCを実行できない'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.upsert_my_avatar_profile(text,jsonb,integer,text)',
    'EXECUTE'
  ),
  true,
  'authenticatedはavatar profile RPCを実行できる'
);

set local role authenticated;
select tests.authenticate_as('profile_user_a');
insert into public.avatar_profiles (owner_id, summary, traits, source_revision, provider)
values (
  tests.get_supabase_uid('profile_user_a'),
  '安全な要約',
  '{"leisure":"読書","communication":"傾聴","lifestyle":"安定","values":"誠実","relationships":"対話","priorities":"調和"}',
  20,
  'mock-v1'
);
select is((select count(*) from public.avatar_profiles), 1::bigint, '本人のprofileを作成・参照できる');

select tests.authenticate_as('profile_user_b');
select is((select count(*) from public.avatar_profiles), 0::bigint, '他利用者のprofileは見えない');
update public.avatar_profiles set summary = '改ざん';

select tests.authenticate_as('profile_user_a');
select is((select summary from public.avatar_profiles), '安全な要約', '他利用者の更新は反映されない');
select is(
  public.upsert_my_avatar_profile(
    '安全な要約',
    '{"leisure":"読書","communication":"傾聴","lifestyle":"安定","values":"誠実","relationships":"対話","priorities":"調和"}',
    20,
    'mock-v1'
  ),
  false,
  '同一profileではwriteをスキップする'
);
select is(
  public.upsert_my_avatar_profile(
    '更新した安全な要約',
    '{"leisure":"読書","communication":"傾聴","lifestyle":"安定","values":"誠実","relationships":"対話","priorities":"調和"}',
    21,
    'mock-v1'
  ),
  true,
  '差分profileだけを更新する'
);

select * from finish();

rollback;
