import type { Metadata } from "next";
import { ConversationListWorkspace } from "../_components/conversation-list-workspace";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ChatPage() {
  return <ConversationListWorkspace />;
}
