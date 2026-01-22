import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-screen flex items-center justify-center'>
      <div className='w-full max-w-md space-y-8 px-4 py-8 sm:px-6 lg:px-8'>
        {children}
      </div>
    </div>
  );
}
