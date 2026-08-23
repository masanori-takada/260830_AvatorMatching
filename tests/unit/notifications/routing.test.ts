import { describe, expect, it } from "vitest";

import { notificationHref } from "@/features/notifications/route";

describe("notificationHref", () => {
  it("contact_readyはchatへ、既存通知はcandidate reportへ送る", () => {
    expect(notificationHref({ kind: "contact_ready", matchRunId: "run-1" })).toBe("/chat");
    expect(notificationHref({ kind: "report_ready", matchRunId: "run-1" })).toBe("/report?matchRunId=run-1");
    expect(notificationHref({ kind: "match_completed", matchRunId: null })).toBe(null);
  });
});
