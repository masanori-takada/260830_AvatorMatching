create schema if not exists tests;

create or replace function tests.get_supabase_uid(user_name text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id
  from auth.users
  where email = user_name || '@example.test';
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
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    user_name || '@example.test',
    '',
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    '{}'::jsonb,
    now(),
    now()
  );

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
end;
$$;
