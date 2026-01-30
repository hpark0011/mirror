import { ThemeToggleButton } from "./theme-toggle-button";

export function NavHeader() {
  return (
    <div className="absolute top-0 left-0 w-full h-12 flex items-center justify-between p-4">
      <h1>UI Factory</h1>
      <ThemeToggleButton />
    </div>
  );
}
