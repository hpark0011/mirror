import { ThemeToggleButton } from "@feel-good/features/theme/components";

export function DashboardHeader() {
  return (
    <header className="fixed top-0 right-0 z-10 flex h-12 items-center gap-2 px-4 transition-[left] duration-200 ease-linear bg-linear-to-b from-background via-background to-transparent w-1/2 justify-end">
      <ThemeToggleButton />
    </header>
  );
}
