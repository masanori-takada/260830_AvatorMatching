-- AI生成契約（24〜36発言、answerRefsはq01〜q42）とDB保存契約を一致させる。
-- 直前のcomplete_match_run定義を引き継ぎ、messages上限とanswerRefs範囲だけを広げる。
create or replace function public.complete_match_run(p_match_run_id uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  owner_id uuid := (select auth.uid());
  run public.match_runs%rowtype;
  report_id uuid;
  candidate_alias text;
  total_count integer;
  completed_count integer;
begin
  select * into run from public.match_runs
  where id = p_match_run_id and match_runs.owner_id = owner_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND' using errcode = 'P0002'; end if;
  if run.status = 'completed' then return; end if;
  if run.status <> 'processing' then raise exception 'STATE_CONFLICT'; end if;
  if run.attempt_count not between 1 and 3 then raise exception 'RETRY_LIMIT'; end if;

  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'INVALID_OUTPUT'; end if;
  if jsonb_typeof(p_payload -> 'messages') is distinct from 'array' then raise exception 'INVALID_OUTPUT'; end if;
  if jsonb_array_length(p_payload -> 'messages') not between 8 and 36 then raise exception 'INVALID_OUTPUT'; end if;
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
        where value !~ '^q(0[1-9]|[1-3][0-9]|4[0-2])$'
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

  -- 通知に候補アバターの匿名エイリアスと進捗(n件中m件完了)を含め、
  -- 「複数の相手と会話が終わった」ことが利用者に伝わるようにする。
  select candidate.avatar_alias into candidate_alias
  from public.demo_candidates candidate where candidate.id = run.candidate_id;
  select count(*)::integer into total_count from public.match_runs where match_runs.owner_id = owner_id;
  select count(*)::integer into completed_count from public.match_runs
  where match_runs.owner_id = owner_id and (status = 'completed' or id = p_match_run_id);

  insert into public.notifications(owner_id, match_run_id, kind, title, body) values
    (owner_id, p_match_run_id, 'match_completed',
      coalesce(candidate_alias, '候補アバター') || 'との会話が完了しました',
      case when completed_count >= total_count and total_count > 1
        then format('%s人全員との会話が完了しました（%s/%s件）。', total_count, completed_count, total_count)
        else format('%sとの会話が完了しました（%s/%s件完了）。', coalesce(candidate_alias, '候補アバター'), completed_count, total_count)
      end),
    (owner_id, p_match_run_id, 'report_ready',
      coalesce(candidate_alias, '候補アバター') || 'の相性レポートができました',
      '5つの軸で相性を確認できます。');

  update public.match_runs set status = 'completed', completed_at = now(), error_code = null
  where id = p_match_run_id;
end;
$$;

revoke all on function public.complete_match_run(uuid, jsonb) from public, anon;
grant execute on function public.complete_match_run(uuid, jsonb) to authenticated;
