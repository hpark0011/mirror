import { FactoryView } from "@/app/views/factory-view";
import { NavHeader } from "@/components/nav-header";

export default function UIFactoryPage() {
  return (
    <>
      <NavHeader />
      <main className="mx-auto min-h-screen">
        <div className="flex flex-col items-center py-20">
          <FactoryView />
        </div>
      </main>
    </>
  );
}
