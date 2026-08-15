create table public.avatar_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  summary text not null check (char_length(summary) between 1 and 600),
  traits jsonb not null check (
    jsonb_typeof(traits) = 'object'
    -- 余分なキーが無いこと。PostgreSQLにはjsonbのキー数を直接返す関数が無いため、
    -- 既知の6キーを取り除いた残りが空であることで表す。下の6つの存在確認と合わせて
    -- 「ちょうどこの6キー」を意味する。
    and traits - array[
      'leisure', 'communication', 'lifestyle', 'values', 'relationships', 'priorities'
    ] = '{}'::jsonb
    and traits ? 'leisure'
    and traits ? 'communication'
    and traits ? 'lifestyle'
    and traits ? 'values'
    and traits ? 'relationships'
    and traits ? 'priorities'
    and char_length(traits ->> 'leisure') between 1 and 200
    and char_length(traits ->> 'communication') between 1 and 200
    and char_length(traits ->> 'lifestyle') between 1 and 200
    and char_length(traits ->> 'values') between 1 and 200
    and char_length(traits ->> 'relationships') between 1 and 200
    and char_length(traits ->> 'priorities') between 1 and 200
  ),
  source_revision integer not null check (source_revision >= 20),
  provider text not null check (char_length(provider) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger avatar_profiles_set_updated_at
before update on public.avatar_profiles
for each row
execute function public.set_updated_at();

alter table public.avatar_profiles enable row level security;
alter table public.avatar_profiles force row level security;

create policy "avatar_profiles_select_own"
on public.avatar_profiles for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "avatar_profiles_insert_own"
on public.avatar_profiles for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "avatar_profiles_update_own"
on public.avatar_profiles for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

revoke all on table public.avatar_profiles from public;
revoke all on table public.avatar_profiles from anon, authenticated;
grant select, insert, update on table public.avatar_profiles to authenticated;

create or replace function public.upsert_my_avatar_profile(
  p_summary text,
  p_traits jsonb,
  p_source_revision integer,
  p_provider text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  changed boolean;
begin
  if owner_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  insert into public.avatar_profiles (
    owner_id, summary, traits, source_revision, provider
  )
  values (
    owner_id, p_summary, p_traits, p_source_revision, p_provider
  )
  on conflict (owner_id) do update
  set summary = excluded.summary,
      traits = excluded.traits,
      source_revision = excluded.source_revision,
      provider = excluded.provider
  where (avatar_profiles.summary, avatar_profiles.traits, avatar_profiles.source_revision, avatar_profiles.provider)
    is distinct from (excluded.summary, excluded.traits, excluded.source_revision, excluded.provider)
  returning true into changed;

  return coalesce(changed, false);
end;
$$;

revoke all on function public.upsert_my_avatar_profile(text, jsonb, integer, text) from public, anon;
grant execute on function public.upsert_my_avatar_profile(text, jsonb, integer, text) to authenticated;
