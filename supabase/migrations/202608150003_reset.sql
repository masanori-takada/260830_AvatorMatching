-- リセット(FR-035): 確認操作の後、現在の匿名利用者に属するデモデータだけを削除して
-- 未開始状態へ戻す。共有の参照データ(demo_candidates / candidate_reveals)は削除しない。
--
-- 削除対象は owner_id で直接所有されるテーブルのうち、interview_answers・avatar_profiles・
-- match_runs の3つ。match_runs を削除すると conversation_messages / compatibility_reports /
-- compatibility_dimensions / decisions はすべて
-- `references public.match_runs(id) on delete cascade` により自動的に削除される
-- (定義は 202608130003_matching.sql, 202608130004_decision_reveal.sql を参照)。
-- これら4テーブルはいずれも match_run_id が not null なので、カスケードだけで確実に消える。
--
-- notifications だけは match_run_id が nullable であり(202608130003_matching.sql)、
-- match_runs のカスケードに依存すると「マッチに紐づかない通知」がリセット後も残りうる。
-- 現時点の通知INSERTはすべてmatch_run_idを指定しているため実害は無いが、それはスキーマが
-- 強制していない不変条件でしかないため、ここでは owner_id を条件に明示的にDELETEする。
--
-- profiles テーブルは auth.users 作成時にトリガーで自動生成されるアカウント行であり、
-- デモの回答・進行状況を一切含まないため削除しない(削除するとむしろ profiles_select_own 等の
-- ポリシー前提が崩れる)。
--
-- 1つの関数内で完結させ、途中で例外が発生した場合は呼び出し全体がロールバックされる
-- (PostgreSQLの関数呼び出しは失敗時に暗黙のsavepointへ巻き戻るため、削除済みと未削除が
-- 混在した状態を利用者に見せることはない)。

create or replace function public.reset_my_demo_data()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  -- 列名owner_idと衝突しない変数名にする(202608150001/202608150002の事故を踏まえた対応)。
  current_owner_id uuid := (select auth.uid());
begin
  if current_owner_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- インタビュー保存・マッチ開始と同じadvisory lockを取得し、リセット中に
  -- 他のリクエスト(回答保存やマッチ開始)が並行して割り込むのを防ぐ。
  perform public.lock_current_user_journey();

  delete from public.interview_answers where owner_id = current_owner_id;
  delete from public.avatar_profiles where owner_id = current_owner_id;
  -- notifications.match_run_id は nullable のため、match_runs のカスケードだけでは
  -- マッチに紐づかない通知が残りうる。owner_id で明示的に削除する(match_runsより先に実行)。
  delete from public.notifications where owner_id = current_owner_id;
  delete from public.match_runs where owner_id = current_owner_id;
end;
$$;

revoke all on function public.reset_my_demo_data() from public, anon;
grant execute on function public.reset_my_demo_data() to authenticated;
