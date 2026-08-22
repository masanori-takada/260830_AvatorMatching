-- 複数候補との同時マッチを可能にする。
--
-- 狙いは「自分のアバターが複数の相手と勝手に会話してきてくれた」という体験を伝えること。
-- 1利用者が同時に最大3件のmatch_runsを持てるようにする。
--
-- 【変更点】
-- 1. match_runs.owner_id の unique を外し、unique (owner_id, candidate_id) にする
--    (同じ相手との重複runは防ぎつつ、複数の相手を持てるようにする)。
-- 2. start_match_run() を、アクティブな候補者から最大3人を選んでrunを作るように変更する。
--    冪等性は「候補者ごとにunique (owner_id, candidate_id)」+ on conflict do nothingで担保する
--    (二度呼んでも既存runと重複しない。既存の「owner単位でユニーク」という冪等性の考え方を
--    「(owner, candidate)単位でユニーク」に引き継いでいる)。
-- 3. 「承諾は1利用者につき1件まで」をDBで保証するため、decisionsに部分ユニーク
--    インデックスを追加する。アプリ側のチェックだけに頼らない(同時送信対策、SC-006関連)。
-- 4. complete_match_run()に候補アバターの匿名エイリアスと「n件中m件完了」を通知本文へ
--    含める変更を加え、「複数の相手と会話が終わった」ことが利用者に伝わるようにする。
--
-- claim_match_run() / fail_match_run() はrun単位のまま変更不要(owner単位の前提は無い)。
--
-- 【answer_countのバグ修正について】
-- 202608130003_matching.sqlのstart_match_run()は `answer_count <> 20` で回答完了を
-- 判定していたが、202608220001_interview_profile_questions.sqlで質問は全41問
-- (TOTAL_QUESTIONS, src/features/interview/domain.ts)に増えており、実際には
-- 回答完了しても20問にはならず常にINTERVIEW_INCOMPLETEになっていた
-- (このマイグレーションを書くにあたりstart_match_run()を全面的に書き換える必要があるため、
-- あわせて41に修正する。既存マイグレーションファイル自体は書き換えない)。

-- ------------------------------------------------------------------
-- 1. owner単位のuniqueを外し、(owner, candidate)単位のuniqueにする。
-- ------------------------------------------------------------------
alter table public.match_runs drop constraint match_runs_owner_id_key;
alter table public.match_runs add constraint match_runs_owner_id_candidate_id_key unique (owner_id, candidate_id);

-- ------------------------------------------------------------------
-- 2. start_match_run(): アクティブな候補者から最大3人を選んでrunを作る。
-- ------------------------------------------------------------------
create or replace function public.start_match_run()
returns table (match_run_id uuid, status public.match_status)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  owner_id uuid;
  selected_provider text;
  profile_source_revision integer;
  answer_count integer;
  current_source_revision integer;
begin
  owner_id := public.lock_current_user_journey();

  select count(*)::integer, coalesce(sum(answer.revision), 0)::integer
  into answer_count, current_source_revision
  from public.interview_answers answer where answer.owner_id = owner_id;
  if answer_count <> 41 then
    raise exception 'INTERVIEW_INCOMPLETE';
  end if;
  select profile.provider, profile.source_revision into selected_provider, profile_source_revision
  from public.avatar_profiles profile where profile.owner_id = owner_id;
  if selected_provider is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if profile_source_revision is distinct from current_source_revision then
    raise exception 'STALE_PROFILE';
  end if;

  if not exists (select 1 from public.demo_candidates candidate where candidate.active) then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;

  -- 候補者ごとに最大3件のrunを作る。候補者が3人未満なら、いる分だけ作る。
  -- 冪等性はunique (owner_id, candidate_id) + on conflict do nothingで担保する
  -- (二度呼んでも既存runと重複して増えない)。
  insert into public.match_runs(owner_id, candidate_id, provider)
  select owner_id, candidate.id, selected_provider
  from public.demo_candidates candidate
  where candidate.active
  order by candidate.id
  limit 3
  on conflict (owner_id, candidate_id) do nothing;

  return query
  select run.id, run.status from public.match_runs run
  where run.owner_id = owner_id
  order by run.candidate_id;
end;
$$;

revoke all on function public.start_match_run() from public, anon;
grant execute on function public.start_match_run() to authenticated;

-- ------------------------------------------------------------------
-- 3. complete_match_run(): 候補アバターのエイリアスと進捗(n件中m件完了)を
--    通知本文に含める。検証ロジック自体は202608150002_fix_matching_variable_conflict.sql
--    の内容をそのまま引き継ぎ、通知の組み立て部分だけを変更する。
-- ------------------------------------------------------------------
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

-- ------------------------------------------------------------------
-- 4. 「承諾は1利用者につき1件まで」をDBで保証する。
--    アプリ側のチェックだけに頼らない(同時送信で二重に承諾されうるため、SC-006)。
-- ------------------------------------------------------------------
create unique index decisions_owner_accept_uidx on public.decisions(owner_id) where kind = 'accept';

create or replace function public.commit_decision(
  p_match_run_id uuid,
  p_kind public.decision_kind
)
returns public.decisions
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  current_owner_id uuid := (select auth.uid());
  selected_run public.match_runs%rowtype;
  stored_decision public.decisions%rowtype;
  other_accepted_run_id uuid;
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

  if p_kind = 'accept' then
    -- 高速path: 既に他のrunで承諾済みなら早期に拒否する。
    -- 真の安全性はdecisions_owner_accept_uidx(下のexceptionハンドラ)が保証する。
    select decision.match_run_id into other_accepted_run_id
    from public.decisions decision
    where decision.owner_id = current_owner_id and decision.kind = 'accept'
    for update;
    if other_accepted_run_id is not null then
      raise exception 'ACCEPT_ALREADY_DECIDED';
    end if;
  end if;

  insert into public.decisions(owner_id, match_run_id, kind)
  values (current_owner_id, p_match_run_id, p_kind)
  returning * into stored_decision;
  return stored_decision;
exception
  when unique_violation then
    -- 同時送信レースの最終防波堤。decisions_owner_accept_uidxにより、
    -- 別のrunへ同時に承諾を送っても片方しか成功しない。
    raise exception 'ACCEPT_ALREADY_DECIDED';
end;
$$;

revoke all on function public.commit_decision(uuid, public.decision_kind) from public, anon;
grant execute on function public.commit_decision(uuid, public.decision_kind) to authenticated;
