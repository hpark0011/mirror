import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import { Divider } from "@/components/divider";
import { PeekingDrawerDemo } from "./peeking-drawer-demo";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@feel-good/ui/primitives/drawer";
import { Button } from "@feel-good/ui/primitives/button";

export function DrawerVariants() {
  return (
    <div className="flex flex-col w-full pb-24">
      <Divider />

      <PageSection>
        <PageSectionHeader>Direction: Bottom</PageSectionHeader>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">Open Bottom Drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Bottom Drawer</DrawerTitle>
              <DrawerDescription>
                This drawer slides up from the bottom with a drag handle.
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              <p className="text-muted-foreground text-sm">
                The default direction. Ideal for mobile action sheets and
                confirmations.
              </p>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Direction: Top</PageSectionHeader>
        <Drawer direction="top">
          <DrawerTrigger asChild>
            <Button variant="outline">Open Top Drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Top Drawer</DrawerTitle>
              <DrawerDescription>
                This drawer slides down from the top of the screen.
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              <p className="text-muted-foreground text-sm">
                Useful for notifications or top-anchored panels.
              </p>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
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
            <DrawerHeader>
              <DrawerTitle>Right Drawer</DrawerTitle>
              <DrawerDescription>
                A side panel that slides in from the right.
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              <p className="text-muted-foreground text-sm">
                Great for detail panels, settings, or supplementary content.
              </p>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
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
            <DrawerHeader>
              <DrawerTitle>Left Drawer</DrawerTitle>
              <DrawerDescription>
                A side panel that slides in from the left.
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              <p className="text-muted-foreground text-sm">
                Commonly used for navigation menus or sidebar content.
              </p>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Snap Points: Peek</PageSectionHeader>
        <PeekingDrawerDemo />
      </PageSection>
    </div>
  );
}
