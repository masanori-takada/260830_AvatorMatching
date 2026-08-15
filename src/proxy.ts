import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_GATE_COOKIE_NAME,
  ACCESS_GATE_PATH,
  isAccessGateEnabled,
  verifyGateCookieValue,
} from "@/lib/access-gate/gate";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

// 合言葉ゲートの検証はnode:cryptoのtimingSafeEqualを使うためNode.js runtimeが必要だが、
// Next.js 16のproxy.tsは常にNode.js runtimeで動くため指定は不要(指定するとビルドが失敗する)。

export async function proxy(request: NextRequest) {
  if (isAccessGateEnabled()) {
    const { pathname, search } = request.nextUrl;
    const cookieValue = request.cookies.get(ACCESS_GATE_COOKIE_NAME)?.value;
    const passed = verifyGateCookieValue(cookieValue);

    // 合言葉入力画面自体はゲートしない(通過前でも到達できる必要がある)。
    if (!passed && pathname !== ACCESS_GATE_PATH) {
      const url = request.nextUrl.clone();
      url.pathname = ACCESS_GATE_PATH;
      url.search = "";
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
  }

  return updateSupabaseSession(request);
}

export const config = {
  // _next/static, _next/image, favicon.icoなどの静的アセットはゲート対象外にする。
  // ゲートすると合言葉入力画面自体のCSS/画像が読み込めず表示が崩れるため。
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
