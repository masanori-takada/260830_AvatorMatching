-- リセット(FR-035)が 23503 (foreign_key_violation) で失敗する不具合の修正。
--
-- compatibility_dimensions.evidence_message_id は conversation_messages を参照するが、
-- この外部キーだけ on delete cascade が付いていなかった。
-- reset_my_demo_data が match_runs を削除すると conversation_messages は連鎖削除されるが、
-- その発言を根拠として引用している compatibility_dimensions の行が残り、参照が壊れて拒否される。
--
-- 会話とレポートが完成した利用者だけが踏む。E2Eのリセットテストは数問回答した直後に
-- リセットしており、この経路を通っていなかったため検出できていなかった。
--
-- 根拠にした発言が消えるなら、その軸別評価は意味を持たない。連鎖削除が正しい。

alter table public.compatibility_dimensions
  drop constraint compatibility_dimensions_evidence_message_id_fkey;

alter table public.compatibility_dimensions
  add constraint compatibility_dimensions_evidence_message_id_fkey
  foreign key (evidence_message_id)
  references public.conversation_messages(id)
  on delete cascade;
