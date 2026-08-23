"use client";

import Image from "next/image";
import { useState } from "react";

import styles from "./candidate-photo.module.css";

type CandidatePhotoProps = {
  src: string | null | undefined;
  alt: string;
  // 開示画面は写真が主役なので大きく出す。チャットのヘッダーは既定の小さい方を使う。
  size?: "default" | "large";
};

const PIXEL_SIZE = { default: 96, large: 320 } as const;

export function CandidatePhoto({ src, alt, size = "default" }: CandidatePhotoProps) {
  const [failed, setFailed] = useState(!src);
  const className = size === "large" ? `${styles.photo} ${styles.large}` : styles.photo;

  if (failed || !src) {
    const fallbackClassName =
      size === "large" ? `${styles.fallback} ${styles.large}` : styles.fallback;
    return <div aria-label={`${alt}（画像準備中）`} className={fallbackClassName} role="img">AI</div>;
  }

  return (
    <Image
      alt={alt}
      className={className}
      height={PIXEL_SIZE[size]}
      onError={() => setFailed(true)}
      src={src}
      unoptimized
      width={PIXEL_SIZE[size]}
    />
  );
}
