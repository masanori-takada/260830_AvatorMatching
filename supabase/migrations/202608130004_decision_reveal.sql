create type public.decision_kind as enum ('accept', 'decline');

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  match_run_id uuid not null references public.match_runs(id) on delete cascade,
  kind public.decision_kind not null,
  decided_at timestamptz not null default now(),
  unique (match_run_id)
);

create index decisions_owner_idx on public.decisions(owner_id, match_run_id);

alter table public.decisions enable row level security;
alter table public.decisions force row level security;

create policy "decisions_select_own" on public.decisions
for select to authenticated
using ((select auth.uid()) = owner_id);

revoke all on table public.decisions from public, anon, authenticated;
grant select on table public.decisions to authenticated;

-- 開示元テーブルはRPC以外から参照させない。
revoke all on table public.candidate_reveals from public, anon, authenticated;

create or replace function public.commit_decision(
  p_match_run_id uuid,
  p_kind public.decision_kind
)
returns public.decisions
language plpgsql security definer set search_path = ''
as $$
declare
  current_owner_id uuid := (select auth.uid());
  selected_run public.match_runs%rowtype;
  stored_decision public.decisions%rowtype;
begin
  if current_owner_id is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into selected_run from public.match_runs
  where id = p_match_run_id and owner_id = current_owner_id
  for update;
  if not found then raise exception 'MATCH_NOT_FOUND' using errcode = 'P0002'; end if;
  if selected_run.status <> 'completed' then raise exception 'STATE_CONFLICT'; end if;

  select * into stored_decision from public.decisions
  where match_run_id = p_match_run_id
  for update;
  if found then
    if stored_decision.kind = p_kind then return stored_decision; end if;
    raise exception 'DECISION_CONFLICT:%', stored_decision.kind;
  end if;

  insert into public.decisions(owner_id, match_run_id, kind)
  values (current_owner_id, p_match_run_id, p_kind)
  returning * into stored_decision;
  return stored_decision;
end;
$$;

create or replace function public.get_candidate_reveal(p_match_run_id uuid)
returns table (full_name text, company text, department text, bio text)
language sql stable security definer set search_path = ''
as $$
  select reveal.full_name, reveal.company, reveal.department, reveal.bio
  from public.match_runs run
  join public.decisions decision
    on decision.match_run_id = run.id
   and decision.owner_id = run.owner_id
   and decision.kind = 'accept'
  join public.candidate_reveals reveal on reveal.candidate_id = run.candidate_id
  where run.id = p_match_run_id
    and run.owner_id = (select auth.uid())
    and run.status = 'completed';
$$;

revoke all on function public.commit_decision(uuid, public.decision_kind) from public, anon;
revoke all on function public.get_candidate_reveal(uuid) from public, anon;
grant execute on function public.commit_decision(uuid, public.decision_kind) to authenticated;
grant execute on function public.get_candidate_reveal(uuid) to authenticated;
