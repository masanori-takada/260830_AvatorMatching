import type { NotificationItem } from "./server/queries";

export function notificationHref(item: Pick<NotificationItem, "kind" | "matchRunId">): string | null {
  if (item.kind === "contact_ready") return "/chat";
  if (item.matchRunId && (item.kind === "report_ready" || item.kind === "match_completed")) {
    return `/report?matchRunId=${encodeURIComponent(item.matchRunId)}`;
  }
  return null;
}

