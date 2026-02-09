"use client";

import { SheetContainer } from "../components/sheet-container";
import { useBottomSheet } from "../hooks/use-bottom-sheet";

type MobileProfileLayoutProps = {
  profile: React.ReactNode;
  content:
    | React.ReactNode
    | ((scrollRoot: HTMLDivElement | null) => React.ReactNode);
};

export function MobileProfileLayout({
  profile,
  content,
}: MobileProfileLayoutProps) {
  const { bgRef, sheetRef, handleRef, contentRef, contentElement } =
    useBottomSheet();

  const resolvedContent =
    typeof content === "function" ? content(contentElement) : content;

  return (
    <div className="h-dvh overflow-hidden relative">
      {/* Background layer — scales with progress (imperative) */}
      <div ref={bgRef} className="absolute inset-0 origin-center pt-24">
        {profile}
      </div>

      {/* Sheet layer — translates up with progress (imperative) */}
      <SheetContainer
        ref={sheetRef}
        handleRef={handleRef}
        contentRef={contentRef}
      >
        {resolvedContent}
      </SheetContainer>
    </div>
  );
}
