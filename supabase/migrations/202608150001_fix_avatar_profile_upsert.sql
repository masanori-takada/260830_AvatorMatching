-- upsert_my_avatar_profileのplpgsql変数 owner_id が、on conflict (owner_id) の列参照と
-- 衝突して 42702 (ambiguous_column) で失敗していた。アバター要約の保存が常に失敗するため、
-- インタビュー完了後に一歩も進めない状態だった。
-- 他の関数は match_runs.owner_id のように列を修飾しており同じ問題は起きない。
-- 変数名を current_owner_id へ改め、列名と重ならないようにする。

create or replace function public.upsert_my_avatar_profile(
  p_summary text,
  p_traits jsonb,
  p_source_revision integer,
  p_provider text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_owner_id uuid := (select auth.uid());
  changed boolean;
begin
  if current_owner_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  insert into public.avatar_profiles (
    owner_id, summary, traits, source_revision, provider
  )
  values (
    current_owner_id, p_summary, p_traits, p_source_revision, p_provider
  )
  on conflict (owner_id) do update
  set summary = excluded.summary,
      traits = excluded.traits,
      source_revision = excluded.source_revision,
      provider = excluded.provider
  where (avatar_profiles.summary, avatar_profiles.traits, avatar_profiles.source_revision, avatar_profiles.provider)
    is distinct from (excluded.summary, excluded.traits, excluded.source_revision, excluded.provider)
  returning true into changed;

  return coalesce(changed, false);
end;
$$;

revoke all on function public.upsert_my_avatar_profile(text, jsonb, integer, text) from public, anon;
grant execute on function public.upsert_my_avatar_profile(text, jsonb, integer, text) to authenticated;
