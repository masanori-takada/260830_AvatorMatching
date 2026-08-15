// インタビュー回答の一時保存(下書き)を端末内へ保持するストア。
// 保存に失敗した回答を同じ端末に残し、再送できるようにするため(FR-031、エッジケース)。
// 匿名利用者ごと・質問ごとに名前空間を分け、他利用者や他質問の下書きを混在させない。

export interface DraftStore {
  save(userId: string, questionCode: string, answer: string): void;
  load(userId: string, questionCode: string): string | null;
  remove(userId: string, questionCode: string): void;
  clearForUser(userId: string): void;
}

const STORAGE_PREFIX = "avatar-matching:draft:";

function keyFor(userId: string, questionCode: string): string {
  return `${STORAGE_PREFIX}${userId}:${questionCode}`;
}

function keyPrefixFor(userId: string): string {
  return `${STORAGE_PREFIX}${userId}:`;
}

// SSR実行時や、プライベートモード等でlocalStorageが使えない環境でも例外で
// 画面を止めないよう、アクセスできない場合はnullを返す。
function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

export const localDraftStore: DraftStore = {
  save(userId, questionCode, answer) {
    const storage = safeLocalStorage();
    if (!storage) {
      return;
    }
    try {
      storage.setItem(keyFor(userId, questionCode), answer);
    } catch {
      // 保存領域が使えない場合はメモリ上の入力のみで継続する
    }
  },

  load(userId, questionCode) {
    const storage = safeLocalStorage();
    if (!storage) {
      return null;
    }
    try {
      return storage.getItem(keyFor(userId, questionCode));
    } catch {
      return null;
    }
  },

  remove(userId, questionCode) {
    const storage = safeLocalStorage();
    if (!storage) {
      return;
    }
    try {
      storage.removeItem(keyFor(userId, questionCode));
    } catch {
      // 削除できなくても致命的ではないため無視する
    }
  },

  clearForUser(userId) {
    const storage = safeLocalStorage();
    if (!storage) {
      return;
    }
    try {
      const prefix = keyPrefixFor(userId);
      const keysToRemove: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => storage.removeItem(key));
    } catch {
      // 一括削除に失敗しても致命的ではないため無視する
    }
  },
};
