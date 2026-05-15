import { preloadAuthOptionalQuery } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
import { ProjectsWorkspaceProvider } from "@/features/projects";

export default async function ProjectsContentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const preloadedProjects = await preloadAuthOptionalQuery(
    api.projects.queries.getByUsername,
    { username },
  );

  return (
    <ProjectsWorkspaceProvider
      preloadedProjects={preloadedProjects}
      username={username}
    >
      {children}
    </ProjectsWorkspaceProvider>
  );
}
