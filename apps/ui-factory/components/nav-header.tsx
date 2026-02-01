import Link from "next/link";
import { ThemeToggleButton } from "@/components/theme-toggle-button";

export function NavHeader() {
  return (
    <div className="fixed top-0 left-0 w-full h-12 flex items-center justify-between p-4">
      <Link href="/">
        <h1>UI Archive</h1>
      </Link>
      <ThemeToggleButton />
    </div>
  );
}
