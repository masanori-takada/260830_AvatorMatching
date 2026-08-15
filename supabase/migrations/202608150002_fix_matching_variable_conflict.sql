-- plpgsqlの変数 owner_id が、参照しているテーブルの列 owner_id と衝突し、
-- 実行時に 42702 (ambiguous_column) で失敗していた。
--   where run.owner_id = owner_id   -- 右辺の裸の owner_id が変数か列か判別できない
-- 左辺を修飾しても右辺は曖昧なままで、マッチング系の4関数すべてが該当していた。
--
-- 本体は書き換えず、#variable_conflict use_variable を宣言して裸の名前を変数として
-- 解釈させる。この4関数はいずれも「変数として使う」意図で書かれているため、
-- 挙動は意図どおりに確定する。insertの列リストは式ではないため影響を受けない。

create or replace function public.start_match_run()
returns table (match_run_id uuid, status public.match_status)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
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
#variable_conflict use_variable
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
#variable_conflict use_variable
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
#variable_conflict use_variable
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
