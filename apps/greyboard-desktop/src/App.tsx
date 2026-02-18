import { Outlet } from "react-router-dom";
import { ErrorBoundary } from "./components/error-boundary";

export function App() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 items-center border-b border-border px-4">
        <h1 className="text-sm font-semibold">Greyboard Desktop</h1>
      </header>
      <main className="flex-1 overflow-auto">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
