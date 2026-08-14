create schema if not exists tests;

create table if not exists tests.anonymous_users (
  user_name text primary key,
  user_id uuid unique not null
);

create or replace function tests.get_supabase_uid(user_name text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select user_id
  from tests.anonymous_users
  where user_name = $1;
$$;

create or replace function tests.create_supabase_user(user_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid := extensions.gen_random_uuid();
begin
  if tests.get_supabase_uid(user_name) is not null then
    return tests.get_supabase_uid(user_name);
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    encrypted_password,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_anonymous
  )
  values (
    user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '',
    jsonb_build_object('provider', 'anonymous', 'providers', jsonb_build_array('anonymous')),
    '{}'::jsonb,
    now(),
    now(),
    true
  );

  insert into tests.anonymous_users (user_name, user_id)
  values (user_name, user_id);

  return user_id;
end;
$$;

create or replace function tests.authenticate_as(user_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claim.sub', tests.get_supabase_uid(user_name)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.is_anonymous', 'true', true);
end;
$$;
