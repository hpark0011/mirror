import { preloadAuthOptionalQuery } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
import { BioWorkspaceProvider } from "@/features/bio";

export default async function BioContentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const preloadedBioEntries = await preloadAuthOptionalQuery(
    api.bio.queries.getByUsername,
    { username },
  );

  return (
    <BioWorkspaceProvider
      preloadedBioEntries={preloadedBioEntries}
      username={username}
    >
      {children}
    </BioWorkspaceProvider>
  );
}
