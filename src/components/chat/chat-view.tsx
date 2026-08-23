"use client";

import { FormEvent, useRef, useState } from "react";

import { sendChatMessage } from "@/features/chat/server/actions";
import { waitForMinimumPending } from "@/lib/pending";

import { CandidatePhoto } from "../candidate/candidate-photo";
import { PendingButton } from "../feedback/pending-button";
import styles from "./chat-view.module.css";

export type ChatMessageView = {
  id: string;
  sender: "candidate" | "owner";
  body: string;
  createdAt: string;
};

export type ChatCandidateView = {
  firstName: string;
  photoPath: string | null;
  isAiGenerated: boolean;
};

type ChatViewProps = {
  connectionId: string;
  candidate: ChatCandidateView;
  messages: ChatMessageView[];
};

export function ChatView({ connectionId, candidate, messages: initialMessages }: ChatViewProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError("メッセージを入力してください。空白だけは送信できません。");
      return;
    }
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    const originalText = text;
    setText("");
    const startedAt = Date.now();
    try {
      const result = await sendChatMessage({ connectionId, text: trimmed });
      await waitForMinimumPending(startedAt);
      if (result.ok) {
        setMessages((current) => [...current, {
          id: result.data.messageId,
          sender: "owner",
          body: trimmed,
          createdAt: new Date().toISOString(),
        }]);
        setText("");
      } else {
        setText(originalText);
        setError(result.error.message);
      }
    } catch {
      await waitForMinimumPending(startedAt);
      setText(originalText);
      setError("送信に失敗しました。時間をおいて再試行してください。");
    }
    submittingRef.current = false;
    setSubmitting(false);
  }

  return (
    <section aria-labelledby="chat-title" className={styles.chat}>
      <header className={styles.header}>
        <CandidatePhoto alt={`${candidate.firstName}の写真`} src={candidate.photoPath} />
        <div>
          <h1 id="chat-title">{candidate.firstName}</h1>
          {candidate.isAiGenerated ? <p className={styles.aiNotice}>AI生成の架空プロフィール</p> : null}
        </div>
      </header>
      <ol aria-label="メッセージ一覧" className={styles.messages}>
        {messages.map((message) => (
          <li className={message.sender === "owner" ? styles.ownerMessage : styles.candidateMessage} key={message.id}>
            <p className={styles.sender}>{message.sender === "owner" ? "あなた" : candidate.firstName}</p>
            <p className={styles.body}>{message.body}</p>
          </li>
        ))}
      </ol>
      <form className={styles.composer} onSubmit={submit}>
        {error ? <p role="alert">{error}</p> : null}
        <label htmlFor="chat-message">メッセージ</label>
        <textarea
          id="chat-message"
          maxLength={1000}
          onChange={(event) => setText(event.target.value)}
          placeholder="メッセージを入力"
          disabled={submitting}
          value={text}
        />
        <PendingButton pending={submitting} type="submit">送信</PendingButton>
      </form>
    </section>
  );
}
