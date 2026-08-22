-- 【不具合1】start_match_run()が42P10(ON CONFLICTの指定に一致する一意制約が無い)で
-- 必ず失敗する不具合の補正。202608220001/202608220002は本番へ適用済みのため、
-- 既存ファイルを書き換えるのではなく、本マイグレーションで上書きする。
--
-- 原因: start_match_run()は`#variable_conflict use_variable`を宣言しており、
-- かつ列名owner_idと同じ名前の変数owner_idを持っていた。
--   insert into public.match_runs(owner_id, candidate_id, provider)
--   select owner_id, candidate.id, selected_provider ...
--   on conflict (owner_id, candidate_id) do nothing;
-- use_variableの効果により、on conflict (owner_id, ...)のowner_idが列ではなく
-- 変数として解釈され、競合対象の指定として不正になる(ON CONFLICTの対象列は
-- テーブル別名で修飾できないため、修飾では回避できない)。
--
-- 対応方針は202608150001/202608150003と同じ: 変数名を列名と衝突しない
-- current_owner_idへ改名する。ロジックは変更しない。
--
-- 【他の関数の確認結果】
-- 202608220002_multi_match.sqlで書き換えた他の関数を確認した。
--   claim_match_run() / fail_match_run() : 202608220002では変更されておらず
--     (202608150002のままowner_id変数+use_variableを維持)、on conflictも
--     持たないため今回の問題は起きない。変更不要。
--   complete_match_run(p_match_run_id, p_payload) : owner_id変数+use_variableを
--     維持しているが、on conflict句を一切持たない(通知・レポート・メッセージは
--     すべて単純なinsert)。バグの前提(on conflictの対象列と変数名の衝突)が
--     成立しないため変更不要。
--   commit_decision(p_match_run_id, p_kind) : 変数名は既にcurrent_owner_idであり
--     列名owner_idと衝突しない。decisionsへのinsertはon conflictを使わず、
--     unique_violationを例外ハンドラで捕まえる方式のため、そもそも対象外。
-- 該当したのはstart_match_run()のみ。
create or replace function public.start_match_run()
returns table (match_run_id uuid, status public.match_status)
language plpgsql security definer set search_path = ''
as $$
-- 変数名を列名owner_idと衝突しないcurrent_owner_idへ改名したことで、この関数内に
-- 残る唯一のon conflict対象列(owner_id, candidate_id)は列名として素直に解釈される。
-- 他の裸参照(where answer.owner_id = current_owner_id 等)も変数名が列名と一致しない
-- ため#variable_conflict use_variableが無くても曖昧にならない。よってこの関数では
-- プラグマを外す(他の関数がowner_id変数を維持する理由についてはこのファイル冒頭の
-- コメントを参照)。
declare
  current_owner_id uuid;
  selected_provider text;
  profile_source_revision integer;
  answer_count integer;
  current_source_revision integer;
begin
  current_owner_id := public.lock_current_user_journey();

  select count(*)::integer, coalesce(sum(answer.revision), 0)::integer
  into answer_count, current_source_revision
  from public.interview_answers answer where answer.owner_id = current_owner_id;
  if answer_count <> 41 then
    raise exception 'INTERVIEW_INCOMPLETE';
  end if;
  select profile.provider, profile.source_revision into selected_provider, profile_source_revision
  from public.avatar_profiles profile where profile.owner_id = current_owner_id;
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
  select current_owner_id, candidate.id, selected_provider
  from public.demo_candidates candidate
  where candidate.active
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
-- 【不具合2】候補者3人(ルナ・陽翔・紬)が本番DBに入らない不具合の補正。
--
-- `supabase db push`はsupabase/seed.sqlを実行しない。3人の候補者は
-- 「デモに必ず必要な参照データ」であり、seedではなくマイグレーションで
-- 投入すべきものだった。この投入をマイグレーションへ移し、
-- supabase/seed.sqlは本マイグレーションを唯一の投入元として参照する
-- コメントだけを残す(データの二重管理・食い違いを避けるため)。
--
-- 冪等にするため on conflict (id) do update / on conflict (candidate_id) do update を使う。
-- 既存のルナのデータ(id: ...001)は壊さない。
-- 開示情報(candidate_reveals)はすべて完全な架空であることが分かる表記を維持する。
-- ------------------------------------------------------------------
insert into public.demo_candidates (id, avatar_alias, conversation_profile, disclosure_consent_groups, active)
values (
  '00000000-0000-4000-8000-000000000001',
  'ルナ',
  $profile$
  {
    "interests": ["読書", "家庭料理", "美術館めぐり"],
    "conversation_style": "穏やかに相手の話を聞き、考えてから言葉を選ぶ",
    "values": ["誠実な対話", "無理のない生活リズム"],
    "weekend_style": "本を読んだり、新しい料理を試したりして過ごす"
  }
  $profile$::jsonb,
  array['appearance', 'family_marital']::text[],
  true
)
on conflict (id) do update
set avatar_alias = excluded.avatar_alias,
    conversation_profile = excluded.conversation_profile,
    disclosure_consent_groups = excluded.disclosure_consent_groups,
    active = excluded.active
where (demo_candidates.avatar_alias, demo_candidates.conversation_profile, demo_candidates.disclosure_consent_groups, demo_candidates.active)
  is distinct from (excluded.avatar_alias, excluded.conversation_profile, excluded.disclosure_consent_groups, excluded.active);

-- 2人目・3人目の候補者。「複数の相手と勝手に会話してきてくれた」という体験が伝わるよう、
-- ルナとは性格・会話スタイル・興味をはっきり書き分ける。開示意思グループも3人で変え、
-- 「相手によって会話で触れられる話題が違う」ことを体験として伝える。
--   ルナ  : 一部だけ開示OK(appearance/family_maritalはOK、income/career_educationはNG)
--   陽翔  : ほぼ全開示OK(4グループすべてOK)
--   紬    : ほぼ開示NG(appearanceだけOK、他3グループはNG)
insert into public.demo_candidates (id, avatar_alias, conversation_profile, disclosure_consent_groups, active)
values (
  '00000000-0000-4000-8000-000000000002',
  '陽翔',
  $profile$
  {
    "interests": ["キャンプ", "フットサル", "旅行の計画"],
    "conversation_style": "テンポよく話しかけ、思ったことをまっすぐ言葉にする",
    "values": ["行動して確かめること", "オープンに情報を共有すること"],
    "weekend_style": "友人と外へ出かけたり、次の旅行の計画を立てたりして過ごす"
  }
  $profile$::jsonb,
  array['income', 'career_education', 'appearance', 'family_marital']::text[],
  true
)
on conflict (id) do update
set avatar_alias = excluded.avatar_alias,
    conversation_profile = excluded.conversation_profile,
    disclosure_consent_groups = excluded.disclosure_consent_groups,
    active = excluded.active
where (demo_candidates.avatar_alias, demo_candidates.conversation_profile, demo_candidates.disclosure_consent_groups, demo_candidates.active)
  is distinct from (excluded.avatar_alias, excluded.conversation_profile, excluded.disclosure_consent_groups, excluded.active);

insert into public.demo_candidates (id, avatar_alias, conversation_profile, disclosure_consent_groups, active)
values (
  '00000000-0000-4000-8000-000000000003',
  '紬',
  $profile$
  {
    "interests": ["手芸", "静かな喫茶店めぐり", "詩や短歌を読むこと"],
    "conversation_style": "一つひとつの言葉を選びながら、ゆっくりと丁寧に話す",
    "values": ["安心できる距離感", "急がずに関係を育てること"],
    "weekend_style": "自宅で手芸をしたり、近所の喫茶店で静かに過ごしたりする"
  }
  $profile$::jsonb,
  array['appearance']::text[],
  true
)
on conflict (id) do update
set avatar_alias = excluded.avatar_alias,
    conversation_profile = excluded.conversation_profile,
    disclosure_consent_groups = excluded.disclosure_consent_groups,
    active = excluded.active
where (demo_candidates.avatar_alias, demo_candidates.conversation_profile, demo_candidates.disclosure_consent_groups, demo_candidates.active)
  is distinct from (excluded.avatar_alias, excluded.conversation_profile, excluded.disclosure_consent_groups, excluded.active);

-- 以下の人物・団体・部署・経歴はすべて本デモ用の完全な架空情報。
insert into public.candidate_reveals (candidate_id, full_name, company, department, bio)
values (
  '00000000-0000-4000-8000-000000000001',
  '星乃 ルナ（完全架空）',
  'ルミナス架空企画株式会社（完全架空）',
  '未来対話デザイン室（完全架空）',
  'この人物、氏名、勤務先、部署、経歴は本デモ用に作成した完全な架空情報です。実在の人物・団体とは関係ありません。休日は読書や家庭料理を楽しみ、穏やかな対話を大切にするという設定です。'
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
  '00000000-0000-4000-8000-000000000002',
  '天野 陽翔（完全架空）',
  '架空アウトドアリンク合同会社（完全架空）',
  '体験企画チーム（完全架空）',
  'この人物、氏名、勤務先、部署、経歴は本デモ用に作成した完全な架空情報です。実在の人物・団体とは関係ありません。休日は友人とキャンプや旅行に出かけることが多く、思ったことをまっすぐ言葉にするタイプという設定です。'
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
  '00000000-0000-4000-8000-000000000003',
  '柊 紬（完全架空）',
  '架空手芸工房ことのは（完全架空）',
  '制作部門（完全架空）',
  'この人物、氏名、勤務先、部署、経歴は本デモ用に作成した完全な架空情報です。実在の人物・団体とは関係ありません。休日は手芸や静かな喫茶店めぐりを楽しみ、急がずに関係を育てたいと考えるタイプという設定です。'
)
on conflict (candidate_id) do update
set full_name = excluded.full_name,
    company = excluded.company,
    department = excluded.department,
    bio = excluded.bio
where (candidate_reveals.full_name, candidate_reveals.company, candidate_reveals.department, candidate_reveals.bio)
  is distinct from (excluded.full_name, excluded.company, excluded.department, excluded.bio);
