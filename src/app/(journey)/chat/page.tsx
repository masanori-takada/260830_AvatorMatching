import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { ChatView } from "@/components/chat/chat-view";
import { getCurrentChat } from "@/features/chat/server/queries";

export default async function ChatPage() {
  const chat = await getCurrentChat();
  if (!chat) redirect("/matches");

  return (
    <AppShell activeTab="chat" showNavigation>
      <ChatView {...chat} />
    </AppShell>
  );
}

