-- 固定20問は環境差分を防ぐため、202608130002_interview.sqlで参照データとして投入する。

-- 候補者の匿名面には、本人特定につながる属性を含めない。
insert into public.demo_candidates (id, avatar_alias, conversation_profile, active)
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
  true
)
on conflict (id) do update
set avatar_alias = excluded.avatar_alias,
    conversation_profile = excluded.conversation_profile,
    active = excluded.active;

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
    bio = excluded.bio;
