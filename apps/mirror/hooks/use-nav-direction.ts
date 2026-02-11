"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const isArticleDetailRoute = (path: string) =>
  /^\/@[^/]+\/.+/.test(path);

export function useNavDirection() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const isArticleDetail = isArticleDetailRoute(pathname);

  useLayoutEffect(() => {
    if (pathname === prevPathname.current) return;

    const wasArticleDetail = isArticleDetailRoute(prevPathname.current);
    const isNowArticleDetail = isArticleDetailRoute(pathname);

    if (isNowArticleDetail && !wasArticleDetail) {
      document.documentElement.dataset.navDirection = "forward";
    } else if (!isNowArticleDetail && wasArticleDetail) {
      document.documentElement.dataset.navDirection = "back";
    }

    prevPathname.current = pathname;

    return () => {
      delete document.documentElement.dataset.navDirection;
    };
  }, [pathname]);

  return { isArticleDetail };
}
