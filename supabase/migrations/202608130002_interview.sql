create type public.question_kind as enum ('choice', 'free_text');

create table public.interview_questions (
  code text primary key check (code ~ '^q(?:0[1-9]|1[0-9]|20)$'),
  display_order integer not null unique check (display_order between 1 and 20),
  category text not null check (char_length(category) between 1 and 50),
  kind public.question_kind not null,
  prompt text not null check (char_length(prompt) between 1 and 500),
  choices jsonb not null default '[]'::jsonb check (jsonb_typeof(choices) = 'array'),
  min_length integer,
  max_length integer,
  active boolean not null default true,
  constraint interview_questions_kind_fields_check check (
    (kind = 'choice' and jsonb_array_length(choices) = 3 and min_length is null and max_length is null)
    or
    (kind = 'free_text' and choices = '[]'::jsonb and min_length = 1 and max_length = 500)
  )
);

create table public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  question_code text not null references public.interview_questions(code),
  answer text not null check (
    answer = btrim(answer)
    and char_length(answer) between 1 and 500
  ),
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, question_code)
);

create index interview_answers_question_code_idx
on public.interview_answers(question_code);

create trigger interview_answers_set_updated_at
before update on public.interview_answers
for each row
execute function public.set_updated_at();

insert into public.interview_questions
  (code, display_order, category, kind, prompt, choices, min_length, max_length)
values
  ('q01', 1, '休日・趣味', 'choice', '休日の過ごし方に最も近いのは？', '["外へ出かける", "家でゆっくりする", "日によって半々"]', null, null),
  ('q02', 2, '休日・趣味', 'choice', '自由な時間は誰と過ごすことが多い？', '["一人", "親しい人と少人数", "大勢の仲間"]', null, null),
  ('q03', 3, '休日・趣味', 'choice', '予定の立て方はどちらに近い？', '["早めに決めたい", "その日の気分で決めたい", "相手に合わせたい"]', null, null),
  ('q04', 4, '休日・趣味', 'free_text', '最近、時間を忘れて夢中になったことは？', '[]', 1, 500),
  ('q05', 5, '会話・人付き合い', 'choice', '初対面の人と話すときの自分は？', '["自分から話す", "相手の話を聞く", "空気を見て決める"]', null, null),
  ('q06', 6, '会話・人付き合い', 'choice', '心地よい会話のバランスは？', '["たくさん話し合う", "静かな時間も楽しむ", "相手に合わせる"]', null, null),
  ('q07', 7, '会話・人付き合い', 'choice', '意見が違ったときに取りやすい行動は？', '["率直に話し合う", "少し時間を置く", "共通点を探す"]', null, null),
  ('q08', 8, '会話・人付き合い', 'free_text', '思わず笑ってしまうのは、どんなとき？', '[]', 1, 500),
  ('q09', 9, '仕事・生活リズム', 'choice', '平日の夜の過ごし方に近いのは？', '["外出や交流", "家で休む", "日によって変わる"]', null, null),
  ('q10', 10, '仕事・生活リズム', 'choice', '忙しい時期の連絡頻度は？', '["短くても毎日", "落ち着いた時にまとめて", "相手と相談して決める"]', null, null),
  ('q11', 11, '仕事・生活リズム', 'choice', '会う頻度の希望に近いのは？', '["週に何度か", "週に1回程度", "無理のない時に"]', null, null),
  ('q12', 12, '価値観・将来観', 'free_text', '日々の生活で大切にしていることは？', '[]', 1, 500),
  ('q13', 13, '価値観・将来観', 'choice', 'お金の使い方で大切なのは？', '["経験に使う", "将来に備える", "バランスを取る"]', null, null),
  ('q14', 14, '価値観・将来観', 'choice', '新しいことへの向き合い方は？', '["まず試す", "よく調べてから", "信頼する人と一緒なら試す"]', null, null),
  ('q15', 15, '価値観・将来観', 'choice', '将来のことを話すペースは？', '["早めに話したい", "関係を築いてから", "自然な流れに任せたい"]', null, null),
  ('q16', 16, '恋愛・関係性', 'choice', '好意や感謝の伝え方に近いのは？', '["言葉で伝える", "行動で示す", "両方を大切にする"]', null, null),
  ('q17', 17, '恋愛・関係性', 'choice', '一緒にいて心地よいと感じる相手は？', '["笑いのツボが合う", "価値観が近い", "新しい視点をくれる"]', null, null),
  ('q18', 18, '恋愛・関係性', 'free_text', 'すれ違いが起きたとき、相手にどう向き合ってほしい？', '[]', 1, 500),
  ('q19', 19, '譲れない条件', 'choice', '関係を築くうえで最も大切なのは？', '["誠実さ", "生活リズム", "会話の相性"]', null, null),
  ('q20', 20, '自由回答', '相手に、これだけは知っておいてほしいことは？', '[]', 1, 500);

alter table public.interview_questions enable row level security;
alter table public.interview_questions force row level security;
alter table public.interview_answers enable row level security;
alter table public.interview_answers force row level security;

create policy "interview_questions_select_authenticated"
on public.interview_questions for select to authenticated
using (true);

create policy "interview_answers_select_own"
on public.interview_answers for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "interview_answers_insert_own"
on public.interview_answers for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "interview_answers_update_own"
on public.interview_answers for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

revoke all on table public.interview_questions from anon, authenticated;
revoke all on table public.interview_answers from anon, authenticated;
grant select on table public.interview_questions to authenticated;
grant select on table public.interview_answers to authenticated;

create or replace function public.is_interview_locked()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked boolean := false;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if to_regclass('public.match_runs') is not null then
    execute 'select exists (
      select 1 from public.match_runs where owner_id = $1
    )'
    into locked
    using (select auth.uid());
  end if;

  return locked;
end;
$$;

create or replace function public.save_interview_answer(
  p_question_code text,
  p_answer text,
  p_expected_revision integer default null
)
returns table (revision integer, answered_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  saved_revision integer;
begin
  if current_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if public.is_interview_locked() then
    raise exception 'INTERVIEW_LOCKED';
  end if;

  if p_answer is null or p_answer <> btrim(p_answer) then
    raise exception 'VALIDATION_ERROR';
  end if;

  if not exists (
    select 1
    from public.interview_questions as question
    where question.code = p_question_code
      and question.active
      and (
        (question.kind = 'choice' and question.choices ? p_answer)
        or
        (question.kind = 'free_text' and char_length(p_answer) between question.min_length and question.max_length)
      )
  ) then
    raise exception 'VALIDATION_ERROR';
  end if;

  if p_expected_revision is null then
    insert into public.interview_answers as inserted (owner_id, question_code, answer)
    values (current_user_id, p_question_code, p_answer)
    on conflict (owner_id, question_code) do nothing
    returning inserted.revision into saved_revision;
  else
    update public.interview_answers as existing
    set answer = p_answer,
        revision = existing.revision + 1
    where existing.owner_id = current_user_id
      and existing.question_code = p_question_code
      and existing.revision = p_expected_revision
    returning existing.revision into saved_revision;
  end if;

  if saved_revision is null then
    raise exception 'STATE_CONFLICT';
  end if;

  return query
  select saved_revision,
    count(*)::integer
  from public.interview_answers as answer
  where answer.owner_id = current_user_id;
end;
$$;

revoke all on function public.is_interview_locked() from public, anon;
revoke all on function public.save_interview_answer(text, text, integer) from public, anon;
grant execute on function public.is_interview_locked() to authenticated;
grant execute on function public.save_interview_answer(text, text, integer) to authenticated;
