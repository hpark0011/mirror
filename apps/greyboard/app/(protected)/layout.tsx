import { requireUserInServerComponent } from "@/utils/require-user-in-server-components";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure user is authenticated
  // This will redirect to sign-in if not authenticated
  await requireUserInServerComponent();

  return (
    <div className='min-h-screen bg-background'>
      {/* Simple layout wrapper for protected pages */}
      <main className='mx-auto'>{children}</main>
    </div>
  );
}
