"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, type Preloaded } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import type { Profile } from "@/features/profile";
import {
  ChatInput,
  EditActions,
  EditProfileButton,
  MobileProfileLayout,
  ProfileInfo,
  ProfileProvider,
} from "@/features/profile";
import { ChatProvider, ChatThread } from "@/features/chat";
import { useProfileData } from "@/features/profile/hooks/use-profile-data";
import {
  ArticleWorkspaceProvider,
  ScrollRootProvider,
} from "@/features/articles";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@feel-good/ui/primitives/resizable";
import { WorkspaceNavbar } from "@/components/workspace-navbar";
import {
  ToolbarSlotProvider,
  ToolbarSlotTarget,
} from "@/components/workspace-toolbar-slot";
import { useProfileNavigationEffects } from "@/hooks/use-profile-navigation-effects";

const VideoCallModal = dynamic(
  () => import("@/features/video-call").then((m) => m.VideoCallModal),
  { ssr: false },
);

type ProfileShellProps = {
  profile: Profile;
  preloadedProfile: Preloaded<typeof api.users.queries.getByUsername>;
  preloadedArticles: Preloaded<typeof api.articles.queries.getByUsername>;
  isOwner: boolean;
  children: React.ReactNode;
};

export function ProfileShell(
  {
    profile: initialProfile,
    preloadedProfile,
    preloadedArticles,
    isOwner,
    children,
  }: ProfileShellProps,
) {
  const { profile, articles } = useProfileData({
    initialProfile,
    preloadedProfile,
    preloadedArticles,
  });

  const isMobile = useIsMobile();
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const [chatInputVisible, setChatInputVisible] = useState(false);
  const [activeView, setActiveView] = useState<"profile" | "chat">("profile");
  const [conversationId, setConversationId] = useState<
    Id<"conversations"> | null
  >(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendMessageMutation = useMutation(api.chat.mutations.sendMessage);
  const isSendingFirstRef = useRef(false);

  const handleFirstMessage = useCallback(
    async (message: string) => {
      if (isSendingFirstRef.current) return;
      isSendingFirstRef.current = true;
      try {
        const result = await sendMessageMutation({
          profileOwnerId: profile._id,
          content: message,
        });
        setConversationId(result.conversationId);
        setActiveView("chat");
      } finally {
        isSendingFirstRef.current = false;
      }
    },
    [sendMessageMutation, profile._id],
  );

  const handleBack = useCallback(() => {
    setActiveView("profile");
  }, []);

  const [mobileScrollRoot, setMobileScrollRoot] = useState<
    HTMLDivElement | null
  >(null);
  const [desktopScrollRoot, setDesktopScrollRoot] = useState<
    HTMLDivElement | null
  >(null);

  useProfileNavigationEffects({
    mobile: mobileScrollRoot,
    desktop: desktopScrollRoot,
  });

  const contextValue = useMemo(
    () => ({ isOwner }),
    [isOwner],
  );

  const handleEditClose = useCallback(() => {
    setIsEditing(false);
    setIsSubmitting(false);
  }, []);

  const editButton = isOwner && (
    <div
      className={isMobile
        ? "absolute top-0 right-5 z-10"
        : "absolute top-4 right-4"}
    >
      {isEditing
        ? (
          <EditActions
            isEditing={isEditing}
            isSubmitting={isSubmitting}
            onCancel={handleEditClose}
          />
        )
        : (
          <EditProfileButton
            onClick={() => setIsEditing(true)}
          />
        )}
    </div>
  );

  const profilePanel = (
    <ProfileInfo
      profile={profile}
      isEditing={isEditing}
      onEditComplete={handleEditClose}
      onSubmittingChange={setIsSubmitting}
      onOpenChat={() => setChatInputVisible((prev) => !prev)}
      onOpenVideoCall={() => setVideoCallOpen(true)}
    />
  );

  return (
    <ProfileProvider value={contextValue}>
      <ArticleWorkspaceProvider articles={articles} username={profile.username}>
        {isMobile
          ? (
            activeView === "chat"
              ? (
                <main className="h-screen">
                  <ChatProvider
                    profileOwnerId={profile._id}
                    profileName={profile.name}
                    avatarUrl={profile.avatarUrl ?? null}
                    conversationId={conversationId}
                    onConversationIdChange={setConversationId}
                  >
                    <ChatThread onBack={handleBack} />
                  </ChatProvider>
                </main>
              )
              : (
                <main className="h-screen">
                  <ToolbarSlotProvider>
                    <WorkspaceNavbar className="fixed top-0 inset-x-0" />
                    <MobileProfileLayout
                      profile={
                        <div className="relative h-full flex flex-col">
                          {editButton}
                          {profilePanel}
                          <div className="absolute inset-x-0 bottom-0 flex justify-center px-2 pb-6 pointer-events-none [&>*]:pointer-events-auto">
                            <ChatInput
                              isOpen={chatInputVisible}
                              profileName={profile.name}
                              onSend={handleFirstMessage}
                            />
                          </div>
                        </div>
                      }
                      content={() => (
                        <div className="flex h-full min-h-0 flex-col">
                          <ToolbarSlotTarget />
                          <div className="flex-1 min-h-0 *:h-full">
                            <div
                              ref={setMobileScrollRoot}
                              className="overflow-y-auto overscroll-y-contain h-full px-3"
                            >
                              <ScrollRootProvider value={mobileScrollRoot}>
                                {children}
                              </ScrollRootProvider>
                            </div>
                          </div>
                        </div>
                      )}
                    />
                  </ToolbarSlotProvider>
                </main>
              )
          )
          : (
            <main className="h-screen">
              {/* Profile interaction view */}
              <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={50} minSize={25} maxSize={80}>
                  <ChatProvider
                    profileOwnerId={profile._id}
                    profileName={profile.name}
                    avatarUrl={profile.avatarUrl ?? null}
                    conversationId={conversationId}
                    onConversationIdChange={setConversationId}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {activeView === "profile"
                        ? (
                          <motion.div
                            key="profile"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="relative z-20 h-full flex flex-col justify-start items-center px-6 pt-[88px]"
                          >
                            {editButton}
                            {profilePanel}
                            <div className="absolute inset-x-0 bottom-0 flex justify-center px-6 pb-6 pointer-events-none [&>*]:pointer-events-auto">
                              <ChatInput
                                isOpen={chatInputVisible}
                                profileName={profile.name}
                                onSend={handleFirstMessage}
                              />
                            </div>
                          </motion.div>
                        )
                        : (
                          <motion.div
                            key="chat"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="h-full"
                          >
                            <ChatThread onBack={handleBack} />
                          </motion.div>
                        )}
                    </AnimatePresence>
                  </ChatProvider>
                </ResizablePanel>

                <ResizableHandle className="bg-border-subtle data-[resize-handle-state=hover]:shadow-[0_0_0_1px_var(--color-resizable-handle-hover)] data-[resize-handle-state=drag]:shadow-[0_0_0_1px_var(--color-resizable-handle-hover)] z-30 relative" />

                {/* Content view */}
                <ResizablePanel defaultSize={50} minSize={25} maxSize={80}>
                  <ToolbarSlotProvider>
                    <div className="relative h-full min-w-0 flex flex-col">
                      <WorkspaceNavbar />
                      <ToolbarSlotTarget />
                      <div className="flex-1 min-h-0 *:h-full relative">
                        <div className="w-full absolute top-0 bg-linear-to-b from-background to-transparent max-h-[24px] z-10" />
                        <div
                          ref={setDesktopScrollRoot}
                          className="overflow-y-auto h-full px-4 pb-[64px] pt-8"
                        >
                          {children}
                        </div>
                      </div>
                    </div>
                  </ToolbarSlotProvider>
                </ResizablePanel>
              </ResizablePanelGroup>
            </main>
          )}
      </ArticleWorkspaceProvider>
      {videoCallOpen && (
        <VideoCallModal
          articles={articles}
          onClose={() => setVideoCallOpen(false)}
        />
      )}
    </ProfileProvider>
  );
}
