# Two-Stage Consent, Demo Photos, and Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Every behavior change follows RED → GREEN → REFACTOR.

**Goal:** Add consent-gated demo profile photos and a minimal one-to-one chat that opens only after two mutual approvals.

**Architecture:** Preserve the existing matching/report/decision flow. Treat the existing accepted `decision` as the owner's profile-reveal consent, add a per-match connection state machine for the simulated candidate consent and final contact consent, and attach messages to the connected match. Demo photos are fixed application assets; future real-user photos remain a separate private-Storage phase.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres/RLS/RPC, Zod, Vitest, pgTAP, Playwright.

**Spec:** Approved conversation design from 2026-08-23; this file records the decision-complete implementation contract.

## Global Constraints

- Implementation model: GPT-5.6 Luna. Independent reviewer: GPT-5.6 Sol.
- Demo candidates: all six existing candidates; fixed natural photorealistic adult portraits generated after code review.
- Reveal only first name, age range, interests, bio, and an explicit AI-generated fictional-image label.
- Never reveal surname, company, department, email, or phone automatically.
- One active profile/contact flow and one connected chat per owner. Closing after profile review unlocks another candidate.
- Demo candidate approval is persisted atomically, while the UI shows an immediate pending state for at least 1.2 seconds.
- Chat v1 is text only: one fixed candidate greeting and user replies, 1–1000 trimmed characters, no live AI replies.
- No new runtime environment variables. Do not apply migrations or push/deploy until review and verification complete.

---

### Task 1: Database state machine and security contracts

**Files:**
- Create one timestamped Supabase migration using `supabase migration new`.
- Modify pgTAP and unit DB-contract tests covering decision/reveal/reset.

**Interfaces:**
- Keep `public.commit_decision(uuid, decision_kind)` as the first-stage owner decision boundary.
- Extend `public.get_candidate_reveal(uuid)` to return `first_name`, `age_range`, `interests`, `bio`, `photo_path`, and `is_ai_generated` only for `profile_revealed` or later.
- Add `public.commit_contact_decision(uuid, decision_kind)` returning `state` and nullable `connection_id`.
- Add `public.send_chat_message(uuid, text)` returning the inserted message id.
- Add notification kind `contact_ready`.

- [ ] Add failing contract/pgTAP tests for state transitions, ownership, one active flow, closed-flow reselection, message spoof prevention, reset cascade, and six complete reveal profiles; run and verify expected failures.
- [ ] Create `match_connections` with states `profile_pending`, `profile_revealed`, `contact_pending`, `connected`, `closed`, a unique active row per owner, timestamps, and cascade ownership.
- [ ] Create `chat_messages` linked to a connection, with sender `owner|candidate`, body length checks, ownership indexes, RLS, explicit grants, and no direct candidate-sender insert permission.
- [ ] Drop the old owner-wide accepted-decision uniqueness restriction; backfill existing accepted decisions as `profile_revealed` without overwriting newer state.
- [ ] Make accepted profile decisions create/advance the demo connection; final accept atomically connects, inserts one candidate greeting, and creates `contact_ready`; final decline closes and unlocks another candidate.
- [ ] Extend all six reveal rows with the fixed first-name/age/interests/photo metadata and ensure security-definer functions use empty `search_path`, explicit auth/ownership checks, and revoked PUBLIC/anon execution.
- [ ] Extend reset to remove connection/message/notification state while retaining candidate masters.
- [ ] Run targeted tests to GREEN, then all DB-contract unit tests.

### Task 2: Server boundaries and UI flow

**Files:**
- Modify decision queries/actions and reveal/report pages.
- Create focused connection/chat server modules and chat UI components.
- Modify shared AppShell navigation, notifications routing, privacy, FAQ, and reset-facing copy.

**Interfaces:**
- `CandidateReveal = { matchRunId; firstName; ageRange; interests; bio; photoPath; isAiGenerated }`.
- `commitContactDecision(input) -> Result<{ state: "connected" | "closed"; connectionId: string | null }>`.
- `sendChatMessage(input) -> Result<{ messageId: string }>`.
- Add `"chat"` to `AppTab` and `/chat` as the sole current conversation route.

- [ ] Add failing unit/component tests for candidate-specific reveal routing, no pre-consent reveal, pending/disabled feedback, final decline reselection, connected redirect, five-tab navigation, chat authorization, trim/length validation, and notification routing; verify RED.
- [ ] Change report acceptance copy to `プロフィール開示を希望`, preserve the confirmation dialog, and route to `/reveal?matchRunId=...` only after server success and the 1.2-second minimum pending period.
- [ ] Render the photo/profile disclosure with AI-fiction label and only the approved fields; add `連絡を希望する` and `今回は見送る` actions with the same immediate pending behavior.
- [ ] Add `/chat` with candidate header, initial greeting, chronological user messages, an accessible text composer, immediate disabled/spinner state, friendly errors, and persistence after refresh.
- [ ] Add the fifth `チャット` tab, contact-ready notification routing, and update privacy/FAQ to explain no company email/direct contact disclosure.
- [ ] Ensure all six expected `/images/demo-candidates/*.webp` paths have stable mappings and graceful visual placeholders until image generation.
- [ ] Run targeted tests to GREEN, then TypeScript and ESLint.

### Task 3: Cross-flow verification and documentation

**Files:**
- Add or extend E2E specs for decision/reveal/chat/reset.
- Update README/quickstart only where deployment or migration steps change.

- [ ] Add a failing E2E contract for three-candidate comparison → first reveal → close → second reveal → final connect → notification → chat send → reload persistence → reset.
- [ ] Cover no photo before reveal, all six mappings, one active contact, direct-route rejection, duplicate clicks, mobile 390×812 layout, and response feedback.
- [ ] Run all Vitest tests, `tsc --noEmit`, ESLint, and `next build`.
- [ ] Do not run pgTAP without a supported database; record it as pending hosted-migration verification when unavailable.

### Task 4: Independent review, image generation, browser verification, and release

- [ ] Dispatch a fresh GPT-5.6 Sol reviewer over the complete working-tree diff; fix all Critical/Important findings with GPT-5.6 Luna and re-review once.
- [ ] Generate six distinct square photorealistic adult portraits from the existing personas, inspect them, convert to optimized WebP, and place them at the six predeclared paths. Avoid celebrity resemblance, logos, text, sexualized presentation, and misleading realism labels.
- [ ] Re-run full tests/build after adding assets.
- [ ] Apply the migration only after user authorization/current established workflow, then deploy the reviewed commit to Vercel.
- [ ] Use Playwright against production to verify the complete flow, pending response, image loading, navigation, refresh persistence, and reset; report any remaining pgTAP debt separately.
