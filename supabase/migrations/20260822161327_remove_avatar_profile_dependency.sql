-- アバター要約を廃止し、全回答を直接使ってマッチングを開始する。
-- 既存の回答・マッチ結果は保持し、要約テーブルだけを削除する。

drop function if exists public.get_avatar_profile_status();

create or replace function public.start_match_run()
returns table (match_run_id uuid, status public.match_status)
language plpgsql security definer set search_path = ''
as $$
declare
  current_owner_id uuid;
  answer_count integer;
  partner_gender_answer text;
  preferred_gender text;
begin
  current_owner_id := public.lock_current_user_journey();

  select count(*)::integer
  into answer_count
  from public.interview_answers answer where answer.owner_id = current_owner_id;
  if answer_count <> 42 then
    raise exception 'INTERVIEW_INCOMPLETE';
  end if;

  select answer.answer into partner_gender_answer
  from public.interview_answers answer
  where answer.owner_id = current_owner_id and answer.question_code = 'q42';
  preferred_gender := case partner_gender_answer
    when '男性' then 'male'
    when '女性' then 'female'
    else null
  end;

  if not exists (
    select 1 from public.demo_candidates candidate
    where candidate.active and (preferred_gender is null or candidate.gender = preferred_gender)
  ) then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;

  insert into public.match_runs(owner_id, candidate_id, provider)
  select current_owner_id, candidate.id, 'pending'
  from public.demo_candidates candidate
  where candidate.active and (preferred_gender is null or candidate.gender = preferred_gender)
  order by candidate.id
  limit 3
  on conflict (owner_id, candidate_id) do nothing;

  return query
  select run.id, run.status from public.match_runs run
  where run.owner_id = current_owner_id
  order by run.candidate_id;
end;
$$;

revoke all on function public.start_match_run() from public, anon;
grant execute on function public.start_match_run() to authenticated;

create or replace function public.reset_my_demo_data()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  current_owner_id uuid := (select auth.uid());
begin
  if current_owner_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  perform public.lock_current_user_journey();

  delete from public.interview_answers where owner_id = current_owner_id;
  -- match_run_idがnullの通知も残さないため、match_runsより先に所有者単位で削除する。
  delete from public.notifications where owner_id = current_owner_id;
  delete from public.match_runs where owner_id = current_owner_id;
end;
$$;

revoke all on function public.reset_my_demo_data() from public, anon;
grant execute on function public.reset_my_demo_data() to authenticated;

drop function if exists public.upsert_my_avatar_profile(text, jsonb, integer, text);
drop table if exists public.avatar_profiles;
