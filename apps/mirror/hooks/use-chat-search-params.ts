"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useChatSearchParams() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const isChatOpen = searchParams.get("chat") === "1";
  const conversationId = searchParams.get("conversation") ?? undefined;

  const openChat = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.set("chat", "1");
    params.delete("conversation");
    params.delete("chatMode");
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  const closeChat = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("chat");
    params.delete("conversation");
    params.delete("chatMode");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router]);

  const setConversation = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("chat", "1");
      params.set("conversation", id);
      params.delete("chatMode");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router],
  );

  const buildChatAwareHref = useCallback(
    (basePath: string) => {
      if (!isChatOpen) return basePath;
      const params = new URLSearchParams();
      params.set("chat", "1");
      const conv = searchParams.get("conversation");
      if (conv) params.set("conversation", conv);
      return `${basePath}?${params.toString()}`;
    },
    [isChatOpen, searchParams],
  );

  return {
    isChatOpen,
    conversationId,
    openChat,
    closeChat,
    setConversation,
    buildChatAwareHref,
  } as const;
}
