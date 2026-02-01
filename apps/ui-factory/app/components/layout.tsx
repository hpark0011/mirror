import { NavHeader } from "@/components/nav-header";
import React from "react";

export default function ComponentsLayout(
  { children }: { children: React.ReactNode },
) {
  return (
    <div className="mx-auto relative">
      <NavHeader />
      <main className="mx-auto min-h-screen">
        <div className="flex flex-col items-center py-[176px] px-4">
          {children}
        </div>
      </main>
    </div>
  );
}
