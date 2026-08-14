create table public.demo_candidates (
  id uuid primary key,
  avatar_alias text not null check (char_length(avatar_alias) between 1 and 50),
  conversation_profile jsonb not null check (
    jsonb_typeof(conversation_profile) = 'object'
    and not conversation_profile ?| array[
      'full_name',
      'company',
      'department',
      'email',
      'phone',
      'address',
      'birth_date',
      'location'
    ]
  ),
  active boolean not null default true
);

create table public.candidate_reveals (
  candidate_id uuid primary key references public.demo_candidates(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 100),
  company text not null check (char_length(company) between 1 and 200),
  department text not null check (char_length(department) between 1 and 200),
  bio text not null check (char_length(bio) between 1 and 500)
);

alter table public.demo_candidates enable row level security;
alter table public.demo_candidates force row level security;
alter table public.candidate_reveals enable row level security;
alter table public.candidate_reveals force row level security;

create policy "demo_candidates_select_active"
on public.demo_candidates
for select
to authenticated
using (active);

revoke all on table public.demo_candidates from public;
revoke all on table public.demo_candidates from anon, authenticated;
grant select on table public.demo_candidates to authenticated;

-- 開示情報は将来の承諾確認付きSECURITY DEFINER RPCだけが返す。
-- そのRPCは空のsearch_pathとauth.uid()による所有者検証を必須とする。
revoke all on table public.candidate_reveals from public;
revoke all on table public.candidate_reveals from anon, authenticated;
