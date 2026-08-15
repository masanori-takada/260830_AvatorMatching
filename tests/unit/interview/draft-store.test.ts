import { beforeEach, describe, expect, it } from "vitest";

import { localDraftStore } from "@/features/interview/client/draft-store";

describe("localDraftStore", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const otherUserId = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    localStorage.clear();
  });

  it("ユーザーと質問コードごとに下書きを保存・取得できる", () => {
    localDraftStore.save(userId, "q04", "夢中になったこと");
    expect(localDraftStore.load(userId, "q04")).toBe("夢中になったこと");
  });

  it("未保存の下書きはnullを返す", () => {
    expect(localDraftStore.load(userId, "q05")).toBeNull();
  });

  it("removeで指定した質問の下書きだけを消せる", () => {
    localDraftStore.save(userId, "q04", "回答A");
    localDraftStore.save(userId, "q05", "回答B");
    localDraftStore.remove(userId, "q04");
    expect(localDraftStore.load(userId, "q04")).toBeNull();
    expect(localDraftStore.load(userId, "q05")).toBe("回答B");
  });

  it("同じ質問コードでも別ユーザーの下書きは分離される", () => {
    localDraftStore.save(userId, "q04", "自分の回答");
    localDraftStore.save(otherUserId, "q04", "他人の回答");
    expect(localDraftStore.load(userId, "q04")).toBe("自分の回答");
    expect(localDraftStore.load(otherUserId, "q04")).toBe("他人の回答");
  });

  it("保存成功後にremoveすれば再読込しても下書きが残らない", () => {
    localDraftStore.save(userId, "q08", "送信前の一時保存");
    localDraftStore.remove(userId, "q08");
    expect(localDraftStore.load(userId, "q08")).toBeNull();
  });

  it("clearForUserは指定ユーザーの下書きだけを一括削除する", () => {
    localDraftStore.save(userId, "q04", "回答A");
    localDraftStore.save(userId, "q05", "回答B");
    localDraftStore.save(otherUserId, "q04", "他人の回答");

    localDraftStore.clearForUser(userId);

    expect(localDraftStore.load(userId, "q04")).toBeNull();
    expect(localDraftStore.load(userId, "q05")).toBeNull();
    expect(localDraftStore.load(otherUserId, "q04")).toBe("他人の回答");
  });
});
