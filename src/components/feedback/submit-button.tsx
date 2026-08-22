"use client";

import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { useFormStatus } from "react-dom";

import { PendingButton } from "./pending-button";

type SubmitButtonProps = Omit<ComponentPropsWithoutRef<typeof PendingButton>, "pending" | "type">;

/**
 * Server Actionの<form action={...}>配下に置く送信ボタン。
 * useFormStatusは親<form>のsubmit状態を参照するため、<form>とは別の
 * コンポーネントで呼ぶ必要がある。このコンポーネントがその役割を担う
 * (お知らせカードのNotificationButtonと同じ構造)。
 */
export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(function SubmitButton(props, ref) {
  const { pending } = useFormStatus();
  return <PendingButton {...props} pending={pending} ref={ref} type="submit" />;
});
