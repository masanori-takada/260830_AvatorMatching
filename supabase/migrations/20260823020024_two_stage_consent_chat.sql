-- 二段階の相互承認と、接続後だけ利用できる1対1チャットを追加する。
-- 既存のmatching/decision migrationは変更せず、このmigrationで最終定義を上書きする。

alter type public.notification_kind add value if not exists 'contact_ready';

create type public.match_connection_state as enum (
  'profile_pending',
  'profile_revealed',
  'contact_pending',
  'connected',
  'closed'
);

-- 承諾後に画面へ返す情報は、既存の姓・会社・部署の列と分離した6項目だけにする。
alter table public.candidate_reveals
  add column first_name text,
  add column age_range text,
  add column interests text[],
  add column photo_path text,
  add column is_ai_generated boolean not null default true;

alter table public.candidate_reveals
  add constraint candidate_reveals_first_name_check
    check (first_name is null or char_length(first_name) between 1 and 50),
  add constraint candidate_reveals_age_range_check
    check (age_range is null or char_length(age_range) between 1 and 30),
  add constraint candidate_reveals_photo_path_check
    check (photo_path is null or photo_path ~ '^/images/demo-candidates/[a-z0-9-]+\.webp$');

-- 画像ファイルはTask 4で追加する。パスはコードとDBで先に固定し、未配置時はUI側でfallbackする。
update public.candidate_reveals
set first_name = 'ルナ',
    age_range = '30代前半',
    interests = array['読書', '家庭料理', '美術館めぐり']::text[],
    bio = '読書や家庭料理、美術館めぐりを楽しみながら、穏やかで無理のない対話を大切にする人です。',
    photo_path = '/images/demo-candidates/luna.webp',
    is_ai_generated = true
where candidate_id = '00000000-0000-4000-8000-000000000001';

update public.candidate_reveals
set first_name = '陽翔',
    age_range = '30代前半',
    interests = array['キャンプ', 'フットサル', '旅行の計画']::text[],
    bio = 'キャンプやフットサル、旅行の計画が好きで、思ったことをまっすぐ言葉にする人です。',
    photo_path = '/images/demo-candidates/haruto.webp',
    is_ai_generated = true
where candidate_id = '00000000-0000-4000-8000-000000000002';

update public.candidate_reveals
set first_name = '紬',
    age_range = '20代後半',
    interests = array['手芸', '静かな喫茶店めぐり', '詩や短歌を読むこと']::text[],
    bio = '手芸や静かな喫茶店めぐりを楽しみ、急がずに関係を育てたいと考える人です。',
    photo_path = '/images/demo-candidates/tsumugi.webp',
    is_ai_generated = true
where candidate_id = '00000000-0000-4000-8000-000000000003';

update public.candidate_reveals
set first_name = '蒼太',
    age_range = '30代前半',
    interests = array['バスケットボール', 'ロードバイク', '筋力トレーニング']::text[],
    bio = 'バスケットボールやロードバイクが好きで、目標に向かって行動することを楽しむ人です。',
    photo_path = '/images/demo-candidates/sota.webp',
    is_ai_generated = true
where candidate_id = '00000000-0000-4000-8000-000000000004';

update public.candidate_reveals
set first_name = '隼人',
    age_range = '30代後半',
    interests = array['読書（哲学・歴史）', 'プラネタリウム巡り', '将棋']::text[],
    bio = '哲学や歴史の読書、プラネタリウム巡りが好きで、じっくり考えて話す人です。',
    photo_path = '/images/demo-candidates/hayato.webp',
    is_ai_generated = true
where candidate_id = '00000000-0000-4000-8000-000000000005';

update public.candidate_reveals
set first_name = '芽衣',
    age_range = '20代後半',
    interests = array['お菓子作り', '国内旅行', '写真撮影']::text[],
    bio = 'お菓子作りや国内旅行、写真撮影が好きで、人とのつながりを明るく楽しむ人です。',
    photo_path = '/images/demo-candidates/mei.webp',
    is_ai_generated = true
where candidate_id = '00000000-0000-4000-8000-000000000006';

-- 承認前に表示するAI生成文は、候補マスタの6名だけを完全一致で匿名化する。
-- 正規表現で人名らしい語を広く推測せず、通常文の過剰置換を避ける。
create function public.anonymize_pre_consent_text(p_value text)
returns text
language plpgsql immutable strict set search_path = ''
as $$
declare
  result text := p_value;
begin
  result := replace(result, 'ルナ', '候補アバター');
  result := replace(result, '陽翔', '候補アバター');
  result := replace(result, '紬', '候補アバター');
  result := replace(result, '蒼太', '候補アバター');
  result := replace(result, '隼人', '候補アバター');
  result := replace(result, '芽衣', '候補アバター');
  return result;
end;
$$;

revoke all on function public.anonymize_pre_consent_text(text) from public, anon, authenticated;

create function public.anonymize_pre_consent_generated_content()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_table_name = 'conversation_messages' then
    new.body := public.anonymize_pre_consent_text(new.body);
  elsif tg_table_name = 'compatibility_reports' then
    new.summary := public.anonymize_pre_consent_text(new.summary);
    new.caution := public.anonymize_pre_consent_text(new.caution);
  elsif tg_table_name = 'compatibility_dimensions' then
    new.explanation := public.anonymize_pre_consent_text(new.explanation);
  end if;
  return new;
end;
$$;

create trigger conversation_messages_anonymize_before_reveal
before insert or update on public.conversation_messages
for each row execute function public.anonymize_pre_consent_generated_content();

create trigger compatibility_reports_anonymize_before_reveal
before insert or update on public.compatibility_reports
for each row execute function public.anonymize_pre_consent_generated_content();

create trigger compatibility_dimensions_anonymize_before_reveal
before insert or update on public.compatibility_dimensions
for each row execute function public.anonymize_pre_consent_generated_content();

revoke all on function public.anonymize_pre_consent_generated_content() from public, anon, authenticated;

update public.conversation_messages
set body = public.anonymize_pre_consent_text(body)
where body ~ '(ルナ|陽翔|紬|蒼太|隼人|芽衣)';

update public.compatibility_reports
set summary = public.anonymize_pre_consent_text(summary),
    caution = public.anonymize_pre_consent_text(caution)
where summary ~ '(ルナ|陽翔|紬|蒼太|隼人|芽衣)'
   or caution ~ '(ルナ|陽翔|紬|蒼太|隼人|芽衣)';

update public.compatibility_dimensions
set explanation = public.anonymize_pre_consent_text(explanation)
where explanation ~ '(ルナ|陽翔|紬|蒼太|隼人|芽衣)';

-- 旧matching RPCが候補aliasを通知文へ含めるため、承認前通知は保存時に匿名化する。
create function public.anonymize_pre_reveal_notification()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.kind = 'match_completed' then
    new.title := '候補アバターとの会話が完了しました';
    new.body := '候補アバターとの会話が完了しました。マッチ結果をご確認ください。';
  elsif new.kind = 'report_ready' then
    new.title := '候補アバターの相性レポートができました';
    new.body := '5つの軸で相性を確認できます。';
  end if;
  return new;
end;
$$;

create trigger notifications_anonymize_before_reveal
before insert or update on public.notifications
for each row execute function public.anonymize_pre_reveal_notification();

revoke all on function public.anonymize_pre_reveal_notification() from public, anon, authenticated;

update public.notifications
set title = case kind
      when 'match_completed' then '候補アバターとの会話が完了しました'
      when 'report_ready' then '候補アバターの相性レポートができました'
      else title
    end,
    body = case kind
      when 'match_completed' then '候補アバターとの会話が完了しました。マッチ結果をご確認ください。'
      when 'report_ready' then '5つの軸で相性を確認できます。'
      else body
    end
where kind in ('match_completed', 'report_ready');

create table public.match_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  match_run_id uuid not null unique references public.match_runs(id) on delete cascade,
  state public.match_connection_state not null default 'profile_pending',
  contact_decision public.decision_kind,
  profile_revealed_at timestamptz,
  contact_requested_at timestamptz,
  connected_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index match_connections_one_active_owner_uidx
  on public.match_connections(owner_id)
  where state in ('profile_pending', 'profile_revealed', 'contact_pending', 'connected');

create index match_connections_owner_state_idx
  on public.match_connections(owner_id, state);

create trigger match_connections_set_updated_at
before update on public.match_connections
for each row execute function public.set_updated_at();

-- 既存のowner-wide accept制約は、最終見送り後の候補再選択を妨げるため外す。
drop index if exists public.decisions_owner_accept_uidx;

-- migrationとpgTAPが同じbackfill statementを実行できるよう、権限非公開の内部関数にまとめる。
create function public.backfill_accepted_match_connections()
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  inserted_count integer;
begin
  insert into public.match_connections(owner_id, match_run_id, state, profile_revealed_at)
  select decision.owner_id, decision.match_run_id, 'profile_revealed', coalesce(decision.decided_at, now())
  from public.decisions decision
  join public.match_runs run on run.id = decision.match_run_id and run.owner_id = decision.owner_id
  where decision.kind = 'accept'
    and not exists (
      select 1 from public.match_connections existing
      where existing.match_run_id = decision.match_run_id
    )
  on conflict (match_run_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.backfill_accepted_match_connections() from public, anon, authenticated;

select public.backfill_accepted_match_connections();

alter table public.match_connections enable row level security;
alter table public.match_connections force row level security;

create policy "match_connections_select_own"
on public.match_connections
for select to authenticated
using ((select auth.uid()) = owner_id);

revoke all on table public.match_connections from public, anon, authenticated;
grant select on table public.match_connections to authenticated;

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.match_connections(id) on delete cascade,
  sender text not null check (sender in ('owner', 'candidate')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_messages_owner_connection_created_idx
  on public.chat_messages(owner_id, connection_id, created_at, id);

create unique index chat_messages_one_candidate_greeting_uidx
  on public.chat_messages(connection_id)
  where sender = 'candidate';

create trigger chat_messages_set_updated_at
before update on public.chat_messages
for each row execute function public.set_updated_at();

alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;

create policy "chat_messages_select_own"
on public.chat_messages
for select to authenticated
using ((select auth.uid()) = owner_id);

revoke all on table public.chat_messages from public, anon, authenticated;
grant select on table public.chat_messages to authenticated;

-- 旧RPCの戻り値型は変更できないため、いったん削除して安全な列だけの型で再作成する。
drop function if exists public.get_candidate_reveal(uuid);

create function public.get_candidate_reveal(p_match_run_id uuid)
returns table (
  first_name text,
  age_range text,
  interests text[],
  bio text,
  photo_path text,
  is_ai_generated boolean
)
language plpgsql security definer set search_path = ''
as $$
declare
  current_owner_id uuid := (select auth.uid());
begin
  if current_owner_id is null then
    return;
  end if;

  return query
  select reveal.first_name,
    reveal.age_range,
    reveal.interests,
    reveal.bio,
    reveal.photo_path,
    reveal.is_ai_generated
  from public.match_runs run
  join public.match_connections connection
    on connection.match_run_id = run.id
    and connection.owner_id = current_owner_id
    and connection.state in ('profile_revealed', 'contact_pending', 'connected')
  join public.candidate_reveals reveal on reveal.candidate_id = run.candidate_id
  where run.id = p_match_run_id
    and run.owner_id = current_owner_id
    and reveal.first_name is not null
    and reveal.age_range is not null
    and reveal.interests is not null
    and reveal.photo_path is not null
    and reveal.is_ai_generated;
end;
$$;

revoke all on table public.candidate_reveals from public, anon, authenticated;
revoke all on function public.get_candidate_reveal(uuid) from public, anon;
grant execute on function public.get_candidate_reveal(uuid) to authenticated;

create or replace function public.commit_decision(
  p_match_run_id uuid,
  p_kind public.decision_kind
)
returns public.decisions
language plpgsql security definer set search_path = ''
as $$
declare
  current_owner_id uuid := (select auth.uid());
  selected_run public.match_runs%rowtype;
  stored_decision public.decisions%rowtype;
  active_connection_id uuid;
  created_connection_id uuid;
begin
  if current_owner_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into selected_run
  from public.match_runs run
  where run.id = p_match_run_id and run.owner_id = current_owner_id
  for update;
  if not found then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0002';
  end if;
  if selected_run.status <> 'completed' then
    raise exception 'STATE_CONFLICT';
  end if;

  select * into stored_decision
  from public.decisions decision
  where decision.match_run_id = p_match_run_id
  for update;
  if found then
    if stored_decision.kind = p_kind then
      return stored_decision;
    end if;
    raise exception 'DECISION_CONFLICT:%', stored_decision.kind;
  end if;

  if p_kind = 'accept' then
    select connection.id into active_connection_id
    from public.match_connections connection
    where connection.owner_id = current_owner_id
      and connection.state in ('profile_pending', 'profile_revealed', 'contact_pending', 'connected')
    for update;
    if active_connection_id is not null then
      raise exception 'ACTIVE_CONNECTION_EXISTS';
    end if;
  end if;

  insert into public.decisions(owner_id, match_run_id, kind)
  values (current_owner_id, p_match_run_id, p_kind)
  returning * into stored_decision;

  if p_kind = 'accept' then
    insert into public.match_connections(owner_id, match_run_id, state)
    values (current_owner_id, p_match_run_id, 'profile_pending')
    returning id into created_connection_id;

    -- 候補側のプロフィール開示承認はデモ候補の固定同意として同一トランザクションで確定する。
    update public.match_connections
    set state = 'profile_revealed', profile_revealed_at = now()
    where id = created_connection_id;
  end if;

  return stored_decision;
exception
  when unique_violation then
    raise exception 'ACTIVE_CONNECTION_EXISTS';
end;
$$;

revoke all on function public.commit_decision(uuid, public.decision_kind) from public, anon;
grant execute on function public.commit_decision(uuid, public.decision_kind) to authenticated;

create or replace function public.commit_contact_decision(
  p_connection_id uuid,
  p_kind public.decision_kind
)
returns table (state public.match_connection_state, connection_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  current_owner_id uuid := (select auth.uid());
  selected_connection public.match_connections%rowtype;
begin
  if current_owner_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_kind is null then
    raise exception 'INVALID_CONTACT_DECISION';
  end if;

  select * into selected_connection
  from public.match_connections connection
  where connection.id = p_connection_id
    and connection.owner_id = current_owner_id
  for update;
  if not found then
    raise exception 'CONNECTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if selected_connection.contact_decision is not null then
    if selected_connection.contact_decision <> p_kind then
      raise exception 'CONTACT_DECISION_CONFLICT:%', selected_connection.contact_decision;
    end if;
    return query
    select selected_connection.state,
      case when selected_connection.state = 'connected' then selected_connection.id else null end;
    return;
  end if;

  if selected_connection.state <> 'profile_revealed' then
    raise exception 'CONTACT_STATE_CONFLICT';
  end if;

  if p_kind = 'decline' then
    update public.match_connections
    set state = 'closed', contact_decision = 'decline', closed_at = now()
    where id = selected_connection.id;
    return query select 'closed'::public.match_connection_state, null::uuid;
    return;
  end if;

  update public.match_connections
  set state = 'contact_pending', contact_requested_at = now()
  where id = selected_connection.id;

  insert into public.chat_messages(owner_id, connection_id, sender, body)
  values (
    current_owner_id,
    selected_connection.id,
    'candidate',
    'つながれてうれしいです。まずは気軽にお話ししませんか？'
  );

  update public.match_connections
  set state = 'connected', contact_decision = 'accept', connected_at = now()
  where id = selected_connection.id;

  insert into public.notifications(owner_id, match_run_id, kind, title, body)
  values (
    current_owner_id,
    selected_connection.match_run_id,
    'contact_ready',
    'チャットがはじまりました',
    '候補アバターからメッセージが届いています。'
  )
  on conflict (match_run_id, kind) do nothing;

  return query select 'connected'::public.match_connection_state, selected_connection.id;
end;
$$;

revoke all on function public.commit_contact_decision(uuid, public.decision_kind) from public, anon;
grant execute on function public.commit_contact_decision(uuid, public.decision_kind) to authenticated;

create or replace function public.send_chat_message(
  p_connection_id uuid,
  p_text text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  current_owner_id uuid := (select auth.uid());
  whitespace_chars text := E' \t\n\r'
    || chr(11) || chr(12) || chr(133) || chr(160) || chr(5760)
    || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
    || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201)
    || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287)
    || chr(12288) || chr(65279);
  trimmed_text text := btrim(coalesce(p_text, ''), whitespace_chars);
  inserted_message_id uuid;
begin
  if current_owner_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if char_length(trimmed_text) not between 1 and 1000 then
    raise exception 'INVALID_MESSAGE';
  end if;
  if not exists (
    select 1 from public.match_connections connection
    where connection.id = p_connection_id
      and connection.owner_id = current_owner_id
      and connection.state = 'connected'
  ) then
    raise exception 'CHAT_NOT_CONNECTED';
  end if;

  insert into public.chat_messages(owner_id, connection_id, sender, body)
  values (current_owner_id, p_connection_id, 'owner', trimmed_text)
  returning id into inserted_message_id;
  return inserted_message_id;
end;
$$;

revoke all on function public.send_chat_message(uuid, text) from public, anon;
grant execute on function public.send_chat_message(uuid, text) to authenticated;

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

  delete from public.chat_messages where owner_id = current_owner_id;
  delete from public.match_connections where owner_id = current_owner_id;
  delete from public.notifications where owner_id = current_owner_id;
  delete from public.interview_answers where owner_id = current_owner_id;
  delete from public.match_runs where owner_id = current_owner_id;
end;
$$;

revoke all on function public.reset_my_demo_data() from public, anon;
grant execute on function public.reset_my_demo_data() to authenticated;
