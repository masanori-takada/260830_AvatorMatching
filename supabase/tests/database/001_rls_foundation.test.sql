begin;

select plan(2);

select tests.create_supabase_user('user_a');
select tests.create_supabase_user('user_b');

set local role authenticated;
select tests.authenticate_as('user_a');
insert into public.profiles(id)
values (tests.get_supabase_uid('user_a'))
on conflict do nothing;

select tests.authenticate_as('user_b');
select is(
  (select count(*) from public.profiles),
  1::bigint,
  '自分のprofileだけ見える'
);
select throws_ok(
  $$delete from public.profiles where id = tests.get_supabase_uid('user_a')$$,
  '42501',
  '他利用者のprofileを削除できない'
);

select * from finish();

rollback;
