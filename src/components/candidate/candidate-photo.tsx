"use client";

import Image from "next/image";
import { useState } from "react";

import styles from "./candidate-photo.module.css";

type CandidatePhotoProps = {
  src: string | null | undefined;
  alt: string;
};

export function CandidatePhoto({ src, alt }: CandidatePhotoProps) {
  const [failed, setFailed] = useState(!src);
  if (failed || !src) {
    return <div aria-label={`${alt}（画像準備中）`} className={styles.fallback} role="img">AI</div>;
  }

  return (
    <Image
      alt={alt}
      className={styles.photo}
      height={96}
      onError={() => setFailed(true)}
      src={src}
      unoptimized
      width={96}
    />
  );
}

