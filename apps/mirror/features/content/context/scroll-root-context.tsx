"use client";

import { createContext, useContext } from "react";

const ScrollRootContext = createContext<HTMLElement | null>(null);

export const ScrollRootProvider = ScrollRootContext.Provider;

export function useScrollRoot() {
  return useContext(ScrollRootContext);
}
