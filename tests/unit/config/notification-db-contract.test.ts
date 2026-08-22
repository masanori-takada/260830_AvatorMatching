import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("notification DB契約", () => {
  it("認証ownerだけが通知を既読にできるRPCを公開する", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/2026081300035_notification_read.sql"), "utf8");
    expect(migration).toMatch(/security definer set search_path = ''/i);
    expect(migration).toMatch(/owner_id = \(select auth\.uid\(\)\)/i);
    expect(migration).toMatch(/revoke all on function public\.mark_notification_read\(uuid\) from public, anon/i);
    expect(migration).toMatch(/grant execute on function public\.mark_notification_read\(uuid\) to authenticated/i);
    const pgTap = readFileSync(resolve(process.cwd(), "supabase/tests/database/002_match_processing.test.sql"), "utf8");
    expect(pgTap).toMatch(/select plan\(31\)/i);
    expect(pgTap).toContain("anonは既読RPCを実行できない");
    expect(pgTap).toContain("他ownerは通知を既読にできない");
    expect(pgTap).toContain("既読再実行は同じ時刻を返す");
  });
});
