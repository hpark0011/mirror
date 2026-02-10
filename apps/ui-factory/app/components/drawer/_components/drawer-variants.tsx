"use client";

import { Divider } from "@/components/divider";
import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@feel-good/ui/primitives/drawer";
import { useState } from "react";
import { PeekingBottomDrawer } from "./peeking-bottom-drawer";

export function DrawerVariants() {
  const [bottomDrawerSnapPoints, setBottomDrawerSnapPoints] = useState<
    number | string | null
  >(0.25);
  const [topDrawerSnapPoints, setTopDrawerSnapPoints] = useState<
    number | string | null
  >(0.25);

  return (
    <div className="flex flex-col w-full pb-24">
      <Divider />

      <PageSection>
        <PageSectionHeader>Direction: Bottom</PageSectionHeader>
        <Drawer
          snapPoints={[0.25, 0.5, 1]}
          activeSnapPoint={bottomDrawerSnapPoints}
          setActiveSnapPoint={setBottomDrawerSnapPoints}
        >
          <DrawerTrigger asChild>
            <Button variant="outline">Open Bottom Drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="max-w-md mx-auto mt-6">
              <DrawerHeader>
                <DrawerTitle>Bottom Drawer</DrawerTitle>
                <DrawerDescription>
                  This drawer slides up from the bottom with a drag handle.
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter className="flex justify-center items-center">
                <DrawerClose asChild>
                  <Button
                    variant="outline"
                    size="default"
                    className="w-[160px]"
                  >
                    Close
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Direction: Top</PageSectionHeader>
        <Drawer
          direction="top"
          snapPoints={[0.25, 0.5, 1]}
          activeSnapPoint={topDrawerSnapPoints}
          setActiveSnapPoint={setTopDrawerSnapPoints}
        >
          <DrawerTrigger asChild>
            <Button variant="outline">Open Top Drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="max-w-md mx-auto mt-0">
              <DrawerHeader>
                <DrawerTitle>Top Drawer</DrawerTitle>
                <DrawerDescription>
                  This drawer slides down from the top of the screen.
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter className="flex justify-center items-center pb-13">
                <DrawerClose asChild>
                  <Button
                    variant="outline"
                    size="default"
                    className="w-[160px]"
                  >
                    Close
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Direction: Right</PageSectionHeader>
        <Drawer direction="right">
          <DrawerTrigger asChild>
            <Button variant="outline">Open Right Drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="px-5">
              <DrawerTitle>Right Drawer</DrawerTitle>
              <DrawerDescription>
                A side panel that slides in from the right.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline" size="lg">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Direction: Left</PageSectionHeader>
        <Drawer direction="left">
          <DrawerTrigger asChild>
            <Button variant="outline">Open Left Drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="px-5">
              <DrawerTitle>Left Drawer</DrawerTitle>
              <DrawerDescription>
                A side panel that slides in from the left.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline" size="lg">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Snap Points: Peek</PageSectionHeader>
        <PeekingBottomDrawer />
      </PageSection>
    </div>
  );
}
