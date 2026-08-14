create type public.match_status as enum ('queued', 'processing', 'completed', 'failed');
create type public.notification_kind as enum ('match_completed', 'report_ready');
create type public.compatibility_axis as enum (
  'conversation_flow', 'values_alignment', 'humor_fit', 'mutual_interest', 'mismatch_severity'
);

create table public.match_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.demo_candidates(id),
  status public.match_status not null default 'queued',
  idempotency_key uuid not null unique default gen_random_uuid(),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 3),
  provider text not null check (char_length(provider) between 1 and 100),
  error_code text check (error_code in ('PROVIDER_ERROR', 'INVALID_OUTPUT', 'TIMEOUT', 'INTERNAL_ERROR')),
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  match_run_id uuid not null references public.match_runs(id) on delete cascade,
  turn_index smallint not null check (turn_index >= 1),
  speaker text not null check (speaker in ('user_avatar', 'candidate_avatar')),
  body text not null check (char_length(body) between 1 and 1000),
  answer_refs text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_run_id, turn_index)
);

create table public.compatibility_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  match_run_id uuid not null unique references public.match_runs(id) on delete cascade,
  overall_score smallint not null check (overall_score between 0 and 100),
  summary text not null check (char_length(summary) between 1 and 1000),
  caution text not null check (char_length(caution) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compatibility_dimensions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.compatibility_reports(id) on delete cascade,
  axis public.compatibility_axis not null,
  score smallint not null check (score between 0 and 100),
  explanation text not null check (char_length(explanation) between 1 and 500),
  evidence_message_id uuid not null references public.conversation_messages(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, axis)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  match_run_id uuid references public.match_runs(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_run_id, kind)
);

create index conversation_messages_owner_idx on public.conversation_messages(owner_id, match_run_id);
create index compatibility_reports_owner_idx on public.compatibility_reports(owner_id, match_run_id);
create index compatibility_dimensions_owner_idx on public.compatibility_dimensions(owner_id, report_id);
create index notifications_owner_created_idx on public.notifications(owner_id, created_at desc);

create trigger match_runs_set_updated_at before update on public.match_runs
for each row execute function public.set_updated_at();
create trigger conversation_messages_set_updated_at before update on public.conversation_messages
for each row execute function public.set_updated_at();
create trigger compatibility_reports_set_updated_at before update on public.compatibility_reports
for each row execute function public.set_updated_at();
create trigger compatibility_dimensions_set_updated_at before update on public.compatibility_dimensions
for each row execute function public.set_updated_at();
create trigger notifications_set_updated_at before update on public.notifications
for each row execute function public.set_updated_at();

alter table public.match_runs enable row level security;
alter table public.match_runs force row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_messages force row level security;
alter table public.compatibility_reports enable row level security;
alter table public.compatibility_reports force row level security;
alter table public.compatibility_dimensions enable row level security;
alter table public.compatibility_dimensions force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

create policy "match_runs_select_own" on public.match_runs for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "conversation_messages_select_own" on public.conversation_messages for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "compatibility_reports_select_own" on public.compatibility_reports for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "compatibility_dimensions_select_own" on public.compatibility_dimensions for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "notifications_select_own" on public.notifications for select to authenticated
using ((select auth.uid()) = owner_id);

revoke all on table public.match_runs, public.conversation_messages, public.compatibility_reports,
  public.compatibility_dimensions, public.notifications from public, anon, authenticated;
grant select on table public.match_runs to authenticated;
grant select on table public.conversation_messages to authenticated;
grant select on table public.compatibility_reports to authenticated;
grant select on table public.compatibility_dimensions to authenticated;
grant select on table public.notifications to authenticated;

create or replace function public.start_match_run()
returns table (match_run_id uuid, status public.match_status)
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid;
  selected_candidate_id uuid;
  selected_provider text;
  profile_source_revision integer;
  answer_count integer;
  current_source_revision integer;
begin
  owner_id := public.lock_current_user_journey();

  select run.id, run.status into match_run_id, status
  from public.match_runs run where run.owner_id = owner_id for update;
  if match_run_id is not null then return next; return; end if;

  select count(*)::integer, coalesce(sum(answer.revision), 0)::integer
  into answer_count, current_source_revision
  from public.interview_answers answer where answer.owner_id = owner_id;
  if answer_count <> 20 then
    raise exception 'INTERVIEW_INCOMPLETE';
  end if;
  select profile.provider, profile.source_revision into selected_provider, profile_source_revision
  from public.avatar_profiles profile where profile.owner_id = owner_id;
  if selected_provider is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if profile_source_revision is distinct from current_source_revision then
    raise exception 'STALE_PROFILE';
  end if;
  select candidate.id into selected_candidate_id from public.demo_candidates candidate
  where candidate.active order by candidate.id limit 1;
  if selected_candidate_id is null then raise exception 'CANDIDATE_NOT_FOUND'; end if;

  insert into public.match_runs(owner_id, candidate_id, provider)
  values (owner_id, selected_candidate_id, selected_provider)
  returning id, match_runs.status into match_run_id, status;
  return next;
end;
$$;

create or replace function public.claim_match_run(p_match_run_id uuid)
returns public.match_status language plpgsql security definer set search_path = ''
as $$
declare owner_id uuid := (select auth.uid()); run public.match_runs%rowtype;
begin
  select * into run from public.match_runs
  where id = p_match_run_id and match_runs.owner_id = owner_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND' using errcode = 'P0002'; end if;
  if run.status in ('processing', 'completed') then return run.status; end if;
  if not (run.attempt_count < 3) then raise exception 'RETRY_LIMIT'; end if;
  update public.match_runs set status = 'processing', attempt_count = attempt_count + 1,
    error_code = null, started_at = now(), failed_at = null where id = p_match_run_id;
  return 'processing';
end;
$$;

create or replace function public.complete_match_run(p_match_run_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  run public.match_runs%rowtype;
  report_id uuid;
begin
  select * into run from public.match_runs
  where id = p_match_run_id and match_runs.owner_id = owner_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND' using errcode = 'P0002'; end if;
  if run.status = 'completed' then return; end if;
  if run.status <> 'processing' then raise exception 'STATE_CONFLICT'; end if;
  if run.attempt_count not between 1 and 3 then raise exception 'RETRY_LIMIT'; end if;

  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'INVALID_OUTPUT'; end if;
  if jsonb_typeof(p_payload -> 'messages') is distinct from 'array' then raise exception 'INVALID_OUTPUT'; end if;
  if jsonb_array_length(p_payload -> 'messages') not between 8 and 20 then raise exception 'INVALID_OUTPUT'; end if;
  if jsonb_typeof(p_payload -> 'report') is distinct from 'object' then raise exception 'INVALID_OUTPUT'; end if;
  if jsonb_typeof(p_payload #> '{report,dimensions}') is distinct from 'array' then raise exception 'INVALID_OUTPUT'; end if;
  if jsonb_array_length(p_payload #> '{report,dimensions}') <> 5 then raise exception 'INVALID_OUTPUT'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_payload -> 'messages') message
    where jsonb_typeof(message) is distinct from 'object'
      or jsonb_typeof(message -> 'turnIndex') is distinct from 'number'
      or jsonb_typeof(message -> 'speaker') is distinct from 'string'
      or jsonb_typeof(message -> 'body') is distinct from 'string'
      or jsonb_typeof(message -> 'answerRefs') is distinct from 'array'
  ) then raise exception 'INVALID_OUTPUT'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_payload -> 'messages') with ordinality as item(message, turn_no)
    where (message ->> 'turnIndex') !~ '^[0-9]+$'
      or (message ->> 'turnIndex')::integer <> turn_no
      or message ->> 'speaker' not in ('user_avatar', 'candidate_avatar')
      or char_length(message ->> 'body') not between 1 and 1000
      or jsonb_array_length(message -> 'answerRefs') < 1
      or exists (
        select 1 from jsonb_array_elements_text(message -> 'answerRefs') ref(value)
        where value !~ '^q(0[1-9]|1[0-9]|20)$'
          or not exists (select 1 from public.interview_answers answer
            where answer.owner_id = owner_id and answer.question_code = ref.value)
      )
      or (select count(*) from jsonb_array_elements_text(message -> 'answerRefs'))
        <> (select count(distinct value) from jsonb_array_elements_text(message -> 'answerRefs') ref(value))
  ) then raise exception 'INVALID_OUTPUT'; end if;

  if (select count(distinct ref.value)
      from jsonb_array_elements(p_payload -> 'messages') message
      cross join lateral jsonb_array_elements_text(message -> 'answerRefs') ref(value)) < 3
  then raise exception 'INVALID_OUTPUT'; end if;

  if jsonb_typeof(p_payload #> '{report,overallScore}') is distinct from 'number'
    or jsonb_typeof(p_payload #> '{report,summary}') is distinct from 'string'
    or jsonb_typeof(p_payload #> '{report,caution}') is distinct from 'string'
    or exists (
      select 1 from jsonb_array_elements(p_payload #> '{report,dimensions}') dimension
      where jsonb_typeof(dimension) is distinct from 'object'
        or jsonb_typeof(dimension -> 'axis') is distinct from 'string'
        or jsonb_typeof(dimension -> 'score') is distinct from 'number'
        or jsonb_typeof(dimension -> 'explanation') is distinct from 'string'
        or jsonb_typeof(dimension -> 'evidenceTurnIndex') is distinct from 'number'
    )
  then raise exception 'INVALID_OUTPUT'; end if;

  if (select count(distinct dimension ->> 'axis') = 5
      from jsonb_array_elements(p_payload #> '{report,dimensions}') dimension) is not true
    or exists (
      select 1 from jsonb_array_elements(p_payload #> '{report,dimensions}') dimension
      where dimension ->> 'axis' not in ('conversation_flow','values_alignment','humor_fit','mutual_interest','mismatch_severity')
        or (dimension ->> 'score') !~ '^[0-9]+$'
        or (dimension ->> 'score')::integer not between 0 and 100
        or char_length(dimension ->> 'explanation') not between 1 and 500
        or (dimension ->> 'evidenceTurnIndex') !~ '^[0-9]+$'
        or not exists (select 1 from jsonb_array_elements(p_payload -> 'messages') message
          where (message ->> 'turnIndex')::integer = (dimension ->> 'evidenceTurnIndex')::integer)
    )
    or (p_payload #>> '{report,overallScore}') !~ '^[0-9]+$'
    or (p_payload #>> '{report,overallScore}')::integer not between 0 and 100
    or char_length(p_payload #>> '{report,summary}') not between 1 and 1000
    or char_length(p_payload #>> '{report,caution}') not between 1 and 500
  then raise exception 'INVALID_OUTPUT'; end if;

  delete from public.notifications where match_run_id = p_match_run_id;
  delete from public.compatibility_reports where match_run_id = p_match_run_id;
  delete from public.conversation_messages where match_run_id = p_match_run_id;

  insert into public.conversation_messages(owner_id, match_run_id, turn_index, speaker, body, answer_refs)
  select owner_id, p_match_run_id, (message ->> 'turnIndex')::smallint,
    message ->> 'speaker', message ->> 'body',
    array(select jsonb_array_elements_text(message -> 'answerRefs'))
  from jsonb_array_elements(p_payload -> 'messages') message;

  insert into public.compatibility_reports(owner_id, match_run_id, overall_score, summary, caution)
  values (owner_id, p_match_run_id, (p_payload #>> '{report,overallScore}')::smallint,
    p_payload #>> '{report,summary}', p_payload #>> '{report,caution}') returning id into report_id;

  insert into public.compatibility_dimensions(owner_id, report_id, axis, score, explanation, evidence_message_id)
  select owner_id, report_id, (dimension ->> 'axis')::public.compatibility_axis,
    (dimension ->> 'score')::smallint, dimension ->> 'explanation', message.id
  from jsonb_array_elements(p_payload #> '{report,dimensions}') dimension
  join public.conversation_messages message on message.match_run_id = p_match_run_id
    and message.turn_index = (dimension ->> 'evidenceTurnIndex')::integer;

  insert into public.notifications(owner_id, match_run_id, kind, title, body) values
    (owner_id, p_match_run_id, 'match_completed', '会話が完了しました', 'アバター同士の会話が完了しました。'),
    (owner_id, p_match_run_id, 'report_ready', '相性レポートができました', '5つの軸で相性を確認できます。');

  update public.match_runs set status = 'completed', completed_at = now(), error_code = null
  where id = p_match_run_id;
end;
$$;

create or replace function public.fail_match_run(p_match_run_id uuid, p_error_code text)
returns void language plpgsql security definer set search_path = ''
as $$
declare owner_id uuid := (select auth.uid());
begin
  if p_error_code not in ('PROVIDER_ERROR', 'INVALID_OUTPUT', 'TIMEOUT', 'INTERNAL_ERROR') then
    raise exception 'INVALID_ERROR_CODE';
  end if;
  update public.match_runs set status = 'failed', error_code = p_error_code, failed_at = now()
  where id = p_match_run_id and match_runs.owner_id = owner_id and status = 'processing';
  if not found then raise exception 'STATE_CONFLICT'; end if;
end;
$$;

revoke all on function public.start_match_run() from public, anon;
revoke all on function public.claim_match_run(uuid) from public, anon;
revoke all on function public.complete_match_run(uuid, jsonb) from public, anon;
revoke all on function public.fail_match_run(uuid, text) from public, anon;
grant execute on function public.start_match_run() to authenticated;
grant execute on function public.claim_match_run(uuid) to authenticated;
grant execute on function public.complete_match_run(uuid, jsonb) to authenticated;
grant execute on function public.fail_match_run(uuid, text) to authenticated;

alter publication supabase_realtime add table public.match_runs, public.notifications;
