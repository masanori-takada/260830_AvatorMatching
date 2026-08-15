import { redirect } from "next/navigation";

import { requireUser } from "@/features/identity/server/session";

// ルート("/")は画面ガードのみを担う。実際のホーム表示は /home に集約する(FR-036)。
// 匿名セッションが無い(未開始)場合は/startへ、ある場合は/homeへ送る。
// bottom-navの「ホーム」タブはこのルートを指すため、再読込や直URLアクセスでも
// 保存状態から到達可能な画面へ必ず戻れる。
export default async function RootPage() {
  try {
    await requireUser();
  } catch {
    redirect("/start");
  }

  redirect("/home");
}
