import { describe, expect, it } from "vitest";

import { DEMO_CANDIDATE_PHOTO_PATHS } from "@/features/candidate/demo-candidates";

describe("デモ候補の画像パス契約", () => {
  it("6候補が安定したwebpパスを持ち、未配置でもfallback対象になる", () => {
    expect(Object.keys(DEMO_CANDIDATE_PHOTO_PATHS)).toHaveLength(6);
    expect(Object.values(DEMO_CANDIDATE_PHOTO_PATHS)).toEqual([
      "/images/demo-candidates/luna.webp",
      "/images/demo-candidates/haruto.webp",
      "/images/demo-candidates/tsumugi.webp",
      "/images/demo-candidates/sota.webp",
      "/images/demo-candidates/hayato.webp",
      "/images/demo-candidates/mei.webp",
    ]);
  });
});

