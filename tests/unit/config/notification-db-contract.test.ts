import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("notification DB契約", () => {
  it("認証ownerだけが通知を既読にできるRPCを公開する", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202608150001_notification_read.sql"), "utf8");
    expect(migration).toMatch(/security definer set search_path = ''/i);
    expect(migration).toMatch(/owner_id = \(select auth\.uid\(\)\)/i);
    expect(migration).toMatch(/revoke all on function public\.mark_notification_read\(uuid\) from public, anon/i);
    expect(migration).toMatch(/grant execute on function public\.mark_notification_read\(uuid\) to authenticated/i);
  });
});
