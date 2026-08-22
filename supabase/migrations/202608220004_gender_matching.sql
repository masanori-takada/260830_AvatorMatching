-- 利用者から報告された不具合2・不具合3への対応。
-- 202608220001〜202608220003は本番へ適用済みのため、本マイグレーションで追記する
-- (既存マイグレーションは書き換えない)。
--
-- 【不具合2: 性別が考慮されていない】
-- demo_candidatesに性別を持たせ、「どんな相手を紹介してほしいですか？」の質問(q42)を
-- 追加し、start_match_run()を希望に合う候補者だけからマッチを作るように変更する。
-- 候補者も男性3人・女性3人の計6人へ増やす。
--
-- 【不具合3: 3人全員とマッチして比較できるようにする】
-- start_match_run()は既にactiveな候補者から最大3件を選ぶ実装(202608220002/003)なので、
-- 候補者を6人に増やしてもactive条件+今回の性別フィルタでちょうど3人が残るようにする
-- (男女とも3人ずついるため、「男性」「女性」希望なら3人、「こだわらない」なら6人中3人)。
-- これにより「3人同時にマッチする」体験が希望性別によらず常に成立する。

-- ------------------------------------------------------------------
-- 1. interview_questions: q42(相手に紹介してほしい性別)をq21の直後(display_order=2)に
--    挿入する。202608220001と同じ手順(制約を外す→ずらす→挿入→制約を戻す)を踏む。
--    src/features/interview/domain.ts の同じ変更と対応させること。
-- ------------------------------------------------------------------
alter table public.interview_questions drop constraint interview_questions_code_check;
alter table public.interview_questions drop constraint interview_questions_display_order_check;
alter table public.interview_questions drop constraint interview_questions_display_order_key;

update public.interview_questions
set display_order = display_order + 1
where display_order >= 2;

insert into public.interview_questions
  (code, display_order, category, kind, prompt, choices, min_length, max_length)
values
  ('q42', 2, '基本プロフィール', 'choice', 'どんな相手を紹介してほしいですか？',
    '["男性", "女性", "こだわらない"]', null, null);

alter table public.interview_questions
  add constraint interview_questions_code_check
  check (code ~ '^q(?:0[1-9]|[123][0-9]|4[0-2])$');

alter table public.interview_questions
  add constraint interview_questions_display_order_check
  check (display_order between 1 and 42);

alter table public.interview_questions
  add constraint interview_questions_display_order_key
  unique (display_order);
-- interview_questions_kind_fields_checkは選択肢2〜12個・free_textの条件のままで
-- q42(選択肢3個のchoice)にもそのまま適用できるため変更不要。

-- ------------------------------------------------------------------
-- 2. start_match_run(): 質問数が42問になったことに合わせてanswer_count<>42へ、
--    かつq42(相手に紹介してほしい性別)の回答でdemo_candidates.genderを絞り込む。
--    「こだわらない」なら絞り込まない。ロジック以外(命名規則・冪等性)は
--    202608220003と同じ方針を維持する。
-- ------------------------------------------------------------------
create or replace function public.start_match_run()
returns table (match_run_id uuid, status public.match_status)
language plpgsql security definer set search_path = ''
as $$
-- 202608220003と同じ理由でuse_variableは使わず、列名と衝突しない変数名を選ぶ。
declare
  current_owner_id uuid;
  selected_provider text;
  profile_source_revision integer;
  answer_count integer;
  current_source_revision integer;
  partner_gender_answer text;
  preferred_gender text;
begin
  current_owner_id := public.lock_current_user_journey();

  select count(*)::integer, coalesce(sum(answer.revision), 0)::integer
  into answer_count, current_source_revision
  from public.interview_answers answer where answer.owner_id = current_owner_id;
  if answer_count <> 42 then
    raise exception 'INTERVIEW_INCOMPLETE';
  end if;
  select profile.provider, profile.source_revision into selected_provider, profile_source_revision
  from public.avatar_profiles profile where profile.owner_id = current_owner_id;
  if selected_provider is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if profile_source_revision is distinct from current_source_revision then
    raise exception 'STALE_PROFILE';
  end if;

  -- q42(「どんな相手を紹介してほしいですか？」)の回答から希望性別を導く。
  -- 「男性」「女性」ならdemo_candidates.genderをその値に絞り込み、
  -- 「こだわらない」(またはその他の想定外値)なら絞り込まない。
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

  -- 候補者ごとに最大3件のrunを作る。希望性別に合う候補者だけを対象にする。
  -- 冪等性はunique (owner_id, candidate_id) + on conflict do nothingで担保する。
  insert into public.match_runs(owner_id, candidate_id, provider)
  select current_owner_id, candidate.id, selected_provider
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

-- ------------------------------------------------------------------
-- 3. demo_candidates.gender: 性別を持たせる。既存3人はavatar_aliasの名前から
--    自然な性別を割り当てる(ルナ=female、陽翔=male、紬=female)。
--    NOT NULL制約はバックフィル後に追加する。
-- ------------------------------------------------------------------
alter table public.demo_candidates add column gender text;

update public.demo_candidates set gender = case id
  when '00000000-0000-4000-8000-000000000001' then 'female' -- ルナ
  when '00000000-0000-4000-8000-000000000002' then 'male'   -- 陽翔
  when '00000000-0000-4000-8000-000000000003' then 'female' -- 紬
  else gender
end
where id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003'
);

-- ------------------------------------------------------------------
-- 4. 候補者を男性3人・女性3人の計6人に増やす。新規3人(蒼太・隼人・芽衣)は
--    性格・会話スタイル・興味をはっきり書き分け、開示意思グループも変える。
--    既存3人と合わせて男性=陽翔・蒼太・隼人、女性=ルナ・紬・芽衣。
--   蒼太: 活発でスポーツ好き、結論から話す。開示: incomeだけNG。
--   隼人: 物静かで知的、聞き役寄り。開示: career_educationだけOK、他3つはNG。
--   芽衣: 明るく社交的、相槌が多い。開示: income/family_maritalはOK、他2つはNG。
-- 以下の人物・団体・部署・経歴はすべて本デモ用の完全な架空情報。
-- ------------------------------------------------------------------
insert into public.demo_candidates (id, avatar_alias, gender, conversation_profile, disclosure_consent_groups, active)
values (
  '00000000-0000-4000-8000-000000000004',
  '蒼太',
  'male',
  $profile$
  {
    "interests": ["バスケットボール", "ロードバイク", "筋力トレーニング"],
    "conversation_style": "結論から話し、思ったことを迷わずはっきり伝える",
    "values": ["目標に向けて努力すること", "有言実行"],
    "weekend_style": "試合や練習に出かけたり、体を動かしたりして過ごす"
  }
  $profile$::jsonb,
  array['career_education', 'appearance', 'family_marital']::text[],
  true
)
on conflict (id) do update
set avatar_alias = excluded.avatar_alias,
    gender = excluded.gender,
    conversation_profile = excluded.conversation_profile,
    disclosure_consent_groups = excluded.disclosure_consent_groups,
    active = excluded.active
where (demo_candidates.avatar_alias, demo_candidates.gender, demo_candidates.conversation_profile, demo_candidates.disclosure_consent_groups, demo_candidates.active)
  is distinct from (excluded.avatar_alias, excluded.gender, excluded.conversation_profile, excluded.disclosure_consent_groups, excluded.active);

insert into public.demo_candidates (id, avatar_alias, gender, conversation_profile, disclosure_consent_groups, active)
values (
  '00000000-0000-4000-8000-000000000005',
  '隼人',
  'male',
  $profile$
  {
    "interests": ["読書（哲学・歴史）", "プラネタリウム巡り", "将棋"],
    "conversation_style": "落ち着いた口調で、じっくり考えてから答える聞き役寄り",
    "values": ["知的好奇心を満たすこと", "静かな時間を大切にすること"],
    "weekend_style": "図書館や資料館を巡ったり、将棋を指したりして過ごす"
  }
  $profile$::jsonb,
  array['career_education']::text[],
  true
)
on conflict (id) do update
set avatar_alias = excluded.avatar_alias,
    gender = excluded.gender,
    conversation_profile = excluded.conversation_profile,
    disclosure_consent_groups = excluded.disclosure_consent_groups,
    active = excluded.active
where (demo_candidates.avatar_alias, demo_candidates.gender, demo_candidates.conversation_profile, demo_candidates.disclosure_consent_groups, demo_candidates.active)
  is distinct from (excluded.avatar_alias, excluded.gender, excluded.conversation_profile, excluded.disclosure_consent_groups, excluded.active);

insert into public.demo_candidates (id, avatar_alias, gender, conversation_profile, disclosure_consent_groups, active)
values (
  '00000000-0000-4000-8000-000000000006',
  '芽衣',
  'female',
  $profile$
  {
    "interests": ["お菓子作り", "国内旅行", "写真撮影"],
    "conversation_style": "明るくにこやかに話し、相手の話によく相槌を打つ",
    "values": ["人とのつながりを大切にすること", "毎日を楽しむこと"],
    "weekend_style": "友人とカフェ巡りをしたり、お菓子を焼いたりして過ごす"
  }
  $profile$::jsonb,
  array['income', 'family_marital']::text[],
  true
)
on conflict (id) do update
set avatar_alias = excluded.avatar_alias,
    gender = excluded.gender,
    conversation_profile = excluded.conversation_profile,
    disclosure_consent_groups = excluded.disclosure_consent_groups,
    active = excluded.active
where (demo_candidates.avatar_alias, demo_candidates.gender, demo_candidates.conversation_profile, demo_candidates.disclosure_consent_groups, demo_candidates.active)
  is distinct from (excluded.avatar_alias, excluded.gender, excluded.conversation_profile, excluded.disclosure_consent_groups, excluded.active);

-- 6人分すべてのgenderが埋まった後にNOT NULL・値域制約を追加する。
alter table public.demo_candidates
  add constraint demo_candidates_gender_check check (gender in ('male', 'female'));
alter table public.demo_candidates alter column gender set not null;

-- 以下の人物・団体・部署・経歴はすべて本デモ用の完全な架空情報。
insert into public.candidate_reveals (candidate_id, full_name, company, department, bio)
values (
  '00000000-0000-4000-8000-000000000004',
  '橋詰 蒼太（完全架空）',
  '架空フィットネスラボ合同会社（完全架空）',
  'コーチング事業部（完全架空）',
  'この人物、氏名、勤務先、部署、経歴は本デモ用に作成した完全な架空情報です。実在の人物・団体とは関係ありません。休日はバスケットボールやロードバイクで体を動かすことが多く、結論から迷わず話すタイプという設定です。'
)
on conflict (candidate_id) do update
set full_name = excluded.full_name,
    company = excluded.company,
    department = excluded.department,
    bio = excluded.bio
where (candidate_reveals.full_name, candidate_reveals.company, candidate_reveals.department, candidate_reveals.bio)
  is distinct from (excluded.full_name, excluded.company, excluded.department, excluded.bio);

insert into public.candidate_reveals (candidate_id, full_name, company, department, bio)
values (
  '00000000-0000-4000-8000-000000000005',
  '神崎 隼人（完全架空）',
  '架空図書研究所（完全架空）',
  '資料整理室（完全架空）',
  'この人物、氏名、勤務先、部署、経歴は本デモ用に作成した完全な架空情報です。実在の人物・団体とは関係ありません。休日は図書館や資料館を巡ったり将棋を指したりすることが多く、じっくり考えてから話す聞き役寄りのタイプという設定です。'
)
on conflict (candidate_id) do update
set full_name = excluded.full_name,
    company = excluded.company,
    department = excluded.department,
    bio = excluded.bio
where (candidate_reveals.full_name, candidate_reveals.company, candidate_reveals.department, candidate_reveals.bio)
  is distinct from (excluded.full_name, excluded.company, excluded.department, excluded.bio);

insert into public.candidate_reveals (candidate_id, full_name, company, department, bio)
values (
  '00000000-0000-4000-8000-000000000006',
  '白川 芽衣（完全架空）',
  '架空製菓工房ここのつ（完全架空）',
  '商品開発部（完全架空）',
  'この人物、氏名、勤務先、部署、経歴は本デモ用に作成した完全な架空情報です。実在の人物・団体とは関係ありません。休日は友人とカフェを巡ったりお菓子を焼いたりすることが多く、明るく相槌の多い話し方をするタイプという設定です。'
)
on conflict (candidate_id) do update
set full_name = excluded.full_name,
    company = excluded.company,
    department = excluded.department,
    bio = excluded.bio
where (candidate_reveals.full_name, candidate_reveals.company, candidate_reveals.department, candidate_reveals.bio)
  is distinct from (excluded.full_name, excluded.company, excluded.department, excluded.bio);
