"use client";

import { Divider } from "@/components/divider";
import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@feel-good/ui/primitives/dialog";

export function DialogVariants() {
  return (
    <div className="flex flex-col w-full pb-24">
      <Divider />

      <PageSection>
        <PageSectionHeader>Default</PageSectionHeader>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Default Dialog</DialogTitle>
              <DialogDescription>
                A standard dialog with a close button in the top-right corner.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-1">
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button size="sm" variant="primary">Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Without Close Button</PageSectionHeader>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>No Close Button</DialogTitle>
              <DialogDescription>
                This dialog hides the top-right close icon. Users must use the
                footer actions to dismiss.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-1">
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button size="sm" variant="primary">Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Footer Close Button</PageSectionHeader>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Footer Close</DialogTitle>
              <DialogDescription>
                The footer renders its own close button via the showCloseButton
                prop on DialogFooter.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton>
              <Button size="sm" variant="primary">Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Custom Content</PageSectionHeader>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Custom Content</DialogTitle>
              <DialogDescription>
                Dialogs can contain any content between the header and footer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="bg-muted rounded-xl p-4 text-sm text-muted-foreground leading-[1.2]">
                This is a custom content area. You can place forms, lists, or
                any other content here.
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageSection>
    </div>
  );
}
