import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 1024;

/**
 * Detects if viewport is below mobile breakpoint (1024px).
 * SSR-safe with undefined initial state, returns false during hydration.
 * @returns true if viewport width < 1024px, false otherwise
 * @example
 * const isMobile = useIsMobile();
 * if (isMobile) {
 *   // render mobile layout
 * }
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
