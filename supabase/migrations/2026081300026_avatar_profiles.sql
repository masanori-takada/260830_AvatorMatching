create table public.avatar_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  summary text not null check (char_length(summary) between 1 and 600),
  traits jsonb not null check (
    jsonb_typeof(traits) = 'object'
    and jsonb_object_length(traits) = 6
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
