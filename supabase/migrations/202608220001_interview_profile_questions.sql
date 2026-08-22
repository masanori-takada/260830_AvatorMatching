-- 基本プロフィール17問(q21〜q37)を追加し、既存20問(q01〜q20)と合わせて全37問にする。
-- さらに、デリケートな項目(年収・職業・学歴・身長・体型・婚姻歴・子どもの有無)への
-- 開示意思を尋ねる質問4問(q38〜q41)を追加し、全41問にする。
--
-- 【コードと表示順が一致しない理由】
-- 既存のinterview_answersはquestion_codeを参照しているため、q01〜q20のコードを
-- 振り直すと保存済み回答の意味がずれ、データ削除が必要になる。そこでコードは追加順
-- (q21〜q41)を保ったまま、表示順(display_order)だけを「基本プロフィール17問=1〜17、
-- 開示意思4問=18〜21、既存20問=22〜41」に独立して割り当てる。
-- src/features/interview/domain.ts の同じコメントと対応する。
--
-- 【デリケートな項目と開示意思】
-- 年収(q28)・職業(q27)・最終学歴(q26)・身長(q24)・体型(q25)・婚姻歴(q31)・子どもの有無(q32)は
-- デリケートな項目として扱う。この判定はsrc/features/interview/domain.tsのINTERVIEW_QUESTIONS
-- (sensitiveGroup/consentForGroup)に一元化されており、DB側は質問文言・選択肢を保持するのみで
-- 判定ロジックは持たない。開示可否のフィルタリングはAIへ入力を渡す直前
-- (src/features/matching/server/queries.ts等)で行う。

-- ------------------------------------------------------------------
-- 1. 既存の制約を一旦外す(20問・選択肢3個固定の前提を緩めるため)。
--    display_orderのunique制約も外す。既存行を+17するUPDATEと新規行のINSERTが
--    一時的にdisplay_orderの重複を作りうる(単一UPDATEでの値のローテーションは
--    非defer制約だと途中経過で一意性違反になりうるため)、制約が無い間に安全に並べ替える。
-- ------------------------------------------------------------------
alter table public.interview_questions drop constraint interview_questions_code_check;
alter table public.interview_questions drop constraint interview_questions_display_order_check;
alter table public.interview_questions drop constraint interview_questions_display_order_key;
alter table public.interview_questions drop constraint interview_questions_kind_fields_check;

-- ------------------------------------------------------------------
-- 2. 既存20問のdisplay_orderを22〜41へ移動する(コードはq01〜q20のまま変更しない)。
--    内訳: 基本プロフィール17問(+17) + 開示意思4問(+4) = +21。
-- ------------------------------------------------------------------
update public.interview_questions
set display_order = display_order + 21
where code ~ '^q(?:0[1-9]|1[0-9]|20)$';

-- ------------------------------------------------------------------
-- 3. 基本プロフィール17問を、表示順1〜17として追加する。
--    すべてchoice(free_textにしない)。理由: src/lib/ai/privacy-provider.tsの
--    redactSelfDisclosedIdentityが自由記述から「会社」「勤務先」「所属」「部署」等を
--    含む文を除去するため、職業等を自由記述で聞くと回答が消えてしまう。
-- ------------------------------------------------------------------
insert into public.interview_questions
  (code, display_order, category, kind, prompt, choices, min_length, max_length)
values
  ('q21', 1, '基本プロフィール', 'choice', '性別を教えてください',
    '["男性", "女性", "その他・回答しない"]', null, null),
  ('q22', 2, '基本プロフィール', 'choice', '年齢はどのくらいですか？',
    '["20代前半", "20代後半", "30代前半", "30代後半", "40代前半", "40代後半", "50代以上"]', null, null),
  ('q23', 3, '基本プロフィール', 'choice', 'お住まいの地域はどちらですか？',
    '["北海道・東北", "関東", "中部", "近畿", "中国・四国", "九州・沖縄", "海外"]', null, null),
  ('q24', 4, '基本プロフィール', 'choice', '身長を教えてください',
    '["〜155cm", "156〜160cm", "161〜165cm", "166〜170cm", "171〜175cm", "176〜180cm", "181cm〜"]', null, null),
  ('q25', 5, '基本プロフィール', 'choice', '体型に近いのはどれですか？',
    '["スリム", "標準", "筋肉質", "ぽっちゃり"]', null, null),
  ('q26', 6, '基本プロフィール', 'choice', '最終学歴を教えてください',
    '["高校卒", "専門・短大卒", "大学卒", "大学院卒", "その他"]', null, null),
  ('q27', 7, '基本プロフィール', 'choice', 'お仕事は何をされていますか？',
    '["会社員", "経営者・役員", "公務員", "専門職（医療・法律など）", "技術職", "教育・研究職", "販売・サービス", "自営業・フリーランス", "学生", "その他"]', null, null),
  ('q28', 8, '基本プロフィール', 'choice', '年収帯を教えてください',
    '["〜400万円", "400〜600万円", "600〜800万円", "800〜1000万円", "1000〜1500万円", "1500万円〜", "回答しない"]', null, null),
  ('q29', 9, '基本プロフィール', 'choice', 'お休みはいつが多いですか？',
    '["土日", "平日", "不定期"]', null, null),
  ('q30', 10, '基本プロフィール', 'choice', '今の暮らし方に近いのは？',
    '["一人暮らし", "家族と同居", "ルームシェア", "その他"]', null, null),
  ('q31', 11, '結婚・交際', 'choice', '結婚歴について教えてください',
    '["未婚", "離別", "死別"]', null, null),
  ('q32', 12, '結婚・交際', 'choice', 'お子さんはいらっしゃいますか？',
    '["なし", "いる（同居）", "いる（別居）"]', null, null),
  ('q33', 13, '結婚・交際', 'choice', 'お子さんについての希望は？',
    '["欲しい", "欲しくない", "相手と相談して決めたい"]', null, null),
  ('q34', 14, '結婚・交際', 'choice', '結婚についての考えに近いのは？',
    '["すぐにでも", "2〜3年以内", "良い人がいれば", "今は考えていない"]', null, null),
  ('q35', 15, '結婚・交際', 'choice', '会うまでの進め方で希望に近いのは？',
    '["まず会って話したい", "メッセージを重ねてから", "相手に合わせる"]', null, null),
  ('q36', 16, '生活習慣', 'choice', 'たばこは吸いますか？',
    '["吸わない", "吸う", "電子タバコのみ", "相手の前では吸わない"]', null, null),
  ('q37', 17, '生活習慣', 'choice', 'お酒はどのくらい飲みますか？',
    '["飲まない", "少し飲む", "よく飲む"]', null, null),
  ('q38', 18, '開示の希望', 'choice', '年収について、アバター同士の会話で触れてもよいですか？',
    '["アバター同士の会話で触れてよい", "会ってから自分で話したい"]', null, null),
  ('q39', 19, '開示の希望', 'choice', 'お仕事・最終学歴について、アバター同士の会話で触れてもよいですか？',
    '["アバター同士の会話で触れてよい", "会ってから自分で話したい"]', null, null),
  ('q40', 20, '開示の希望', 'choice', '身長・体型について、アバター同士の会話で触れてもよいですか？',
    '["アバター同士の会話で触れてよい", "会ってから自分で話したい"]', null, null),
  ('q41', 21, '開示の希望', 'choice', '結婚歴・お子さんの有無について、アバター同士の会話で触れてもよいですか？',
    '["アバター同士の会話で触れてよい", "会ってから自分で話したい"]', null, null);

-- ------------------------------------------------------------------
-- 4. 制約を、41問・選択肢2〜12個を許容する形で再作成する。
-- ------------------------------------------------------------------
alter table public.interview_questions
  add constraint interview_questions_code_check
  check (code ~ '^q(?:0[1-9]|[123][0-9]|4[01])$');

alter table public.interview_questions
  add constraint interview_questions_display_order_check
  check (display_order between 1 and 41);

alter table public.interview_questions
  add constraint interview_questions_display_order_key
  unique (display_order);

alter table public.interview_questions
  add constraint interview_questions_kind_fields_check
  check (
    (kind = 'choice' and jsonb_array_length(choices) between 2 and 12 and min_length is null and max_length is null)
    or
    (kind = 'free_text' and choices = '[]'::jsonb and min_length = 1 and max_length = 500)
  );

-- ------------------------------------------------------------------
-- 5. 候補者(demo_candidates)側にも、デリケートな項目グループごとの開示意思を持たせる。
--    「本人が開示OK かつ 相手も開示OK」のときだけAIへ渡す方針(src/features/interview/domain.tsの
--    filterDisclosableAnswers)を成立させるには、相手側にも開示意思が要る。
--    グループの取りうる値はsrc/features/interview/domain.tsのSensitiveGroupと一致させる。
-- ------------------------------------------------------------------
alter table public.demo_candidates
  add column disclosure_consent_groups text[] not null default '{}'::text[];

alter table public.demo_candidates
  add constraint demo_candidates_disclosure_consent_groups_check
  check (
    disclosure_consent_groups <@ array['income', 'career_education', 'appearance', 'family_marital']::text[]
  );
