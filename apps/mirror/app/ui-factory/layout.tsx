import { NavHeader } from "./_components/nav-header";
interface UIFactoryLayoutProps {
  children: React.ReactNode;
}

export default function UIFactoryLayout({ children }: UIFactoryLayoutProps) {
  return (
    <div className="mx-auto relative">
      <NavHeader />
      <main className="mx-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
