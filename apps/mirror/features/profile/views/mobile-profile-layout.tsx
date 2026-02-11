"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@feel-good/ui/primitives/drawer";
import { useState } from "react";

// ~15.85% of viewport — aligns the peek strip with the profile card's bottom edge
const PEEK_SNAP_POINT = 0.165;
const MIDDLE_SNAP_POINT = 0.5;
const EXPANDED_SNAP_POINT = 1;
const SHEET_SNAP_POINTS: Array<number | string> = [
  PEEK_SNAP_POINT,
  MIDDLE_SNAP_POINT,
  EXPANDED_SNAP_POINT,
];

type MobileProfileLayoutProps = {
  profile: React.ReactNode;
  content: React.ReactNode | (() => React.ReactNode);
};

export function MobileProfileLayout({
  profile,
  content,
}: MobileProfileLayoutProps) {
  const [activeSnapPoint, setActiveSnapPoint] = useState<
    number | string | null
  >(
    PEEK_SNAP_POINT,
  );
  const [drawerContainer, setDrawerContainer] = useState<HTMLDivElement | null>(
    null,
  );

  const resolvedContent = typeof content === "function"
    ? content()
    : content;
  const isExpanded = activeSnapPoint === EXPANDED_SNAP_POINT;

  return (
    <div className="h-dvh overflow-hidden relative">
      <div
        className="absolute inset-0 origin-center pt-24 transition-transform duration-300"
        style={{ transform: `scale(${isExpanded ? 0.8 : 1})` }}
      >
        {profile}
      </div>

      <div
        ref={setDrawerContainer}
        className="absolute inset-x-0 bottom-0 top-[48px]"
      >
        <Drawer
          open
          modal={false}
          dismissible={false}
          snapPoints={SHEET_SNAP_POINTS}
          activeSnapPoint={activeSnapPoint}
          setActiveSnapPoint={setActiveSnapPoint}
          container={drawerContainer}
        >
          <DrawerContent
            role="region"
            aria-label="Articles"
            showHandle={false}
            className="absolute inset-0 border-border-subtle"
          >
            <DrawerHeader className="sr-only">
              <DrawerTitle>Articles</DrawerTitle>
              <DrawerDescription>
                Draggable panel that contains the article list.
              </DrawerDescription>
            </DrawerHeader>

            <div className="relative flex h-full flex-col overflow-hidden">
              <div className="absolute top-[32px] z-10 left-0 w-full h-6 bg-linear-to-b from-background to-transparent" />

              <div className="flex items-center justify-center pt-3 pb-4 cursor-grab active:cursor-grabbing touch-none">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
              </div>

              <div className="h-[calc(100%-36px)] pt-2 *:h-full">
                {resolvedContent}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}
