"use client";

import { DailyProvider } from "@daily-co/daily-react";
import type { ReactNode } from "react";

type CVIProviderProps = {
  children: ReactNode;
};

export function CVIProvider({ children }: CVIProviderProps) {
  return <DailyProvider>{children}</DailyProvider>;
}
