import { redirect } from "next/navigation";
import {
  buildProfileSectionHref,
  DEFAULT_PROFILE_SECTION,
} from "@feel-good/convex/convex/content/href";

export default async function ChatConversationRedirect({
  params,
}: {
  params: Promise<{ username: string; conversationId: string }>;
}) {
  const { username } = await params;
  redirect(buildProfileSectionHref(username, DEFAULT_PROFILE_SECTION));
}
