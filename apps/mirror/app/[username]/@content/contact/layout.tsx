import { type ReactNode } from "react";
import { preloadAuthOptionalQuery } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
import { ContactWorkspaceProvider } from "@/features/contact";

export default async function ContactContentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const preloadedContactEntries = await preloadAuthOptionalQuery(
    api.contacts.queries.getByUsername,
    { username },
  );

  return (
    <ContactWorkspaceProvider
      preloadedContactEntries={preloadedContactEntries}
      username={username}
    >
      {children}
    </ContactWorkspaceProvider>
  );
}
