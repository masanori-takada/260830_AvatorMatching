export const PRE_CONSENT_CANDIDATE_NAMES = [
  "ルナ",
  "陽翔",
  "紬",
  "蒼太",
  "隼人",
  "芽衣",
] as const;

export function containsPreConsentCandidateName(value: string): boolean {
  return PRE_CONSENT_CANDIDATE_NAMES.some((name) => value.includes(name));
}

export function anonymizePreConsentText(value: string): string {
  return PRE_CONSENT_CANDIDATE_NAMES.reduce(
    (current, name) => current.replaceAll(name, "候補アバター"),
    value,
  );
}

export function anonymizePreConsentValue(value: unknown): unknown {
  if (typeof value === "string") return anonymizePreConsentText(value);
  if (Array.isArray(value)) return value.map(anonymizePreConsentValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, anonymizePreConsentValue(item)]),
    );
  }
  return value;
}
