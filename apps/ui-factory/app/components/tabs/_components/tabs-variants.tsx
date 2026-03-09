"use client";

import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import { Divider } from "@/components/divider";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@feel-good/ui/primitives/tabs";

export function TabsVariants() {
  return (
    <div className="flex flex-col w-full">
      <Divider />

      <PageSection>
        <PageSectionHeader>Variant: Default</PageSectionHeader>
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Account</TabsTrigger>
            <TabsTrigger value="tab2">Password</TabsTrigger>
            <TabsTrigger value="tab3">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <p className="text-sm text-muted-foreground p-4">
              Account settings content.
            </p>
          </TabsContent>
          <TabsContent value="tab2">
            <p className="text-sm text-muted-foreground p-4">
              Password settings content.
            </p>
          </TabsContent>
          <TabsContent value="tab3">
            <p className="text-sm text-muted-foreground p-4">
              General settings content.
            </p>
          </TabsContent>
        </Tabs>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Variant: Line</PageSectionHeader>
        <Tabs defaultValue="tab1">
          <TabsList variant="line">
            <TabsTrigger value="tab1">Account</TabsTrigger>
            <TabsTrigger value="tab2">Password</TabsTrigger>
            <TabsTrigger value="tab3">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <p className="text-sm text-muted-foreground p-4">
              Account settings content.
            </p>
          </TabsContent>
          <TabsContent value="tab2">
            <p className="text-sm text-muted-foreground p-4">
              Password settings content.
            </p>
          </TabsContent>
          <TabsContent value="tab3">
            <p className="text-sm text-muted-foreground p-4">
              General settings content.
            </p>
          </TabsContent>
        </Tabs>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Variant: Folder Tab</PageSectionHeader>
        <Tabs defaultValue="tab1">
          <TabsList variant="folder">
            <TabsTrigger value="tab1">Account</TabsTrigger>
            <TabsTrigger value="tab2">Password</TabsTrigger>
            <TabsTrigger value="tab3">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <p className="text-sm text-muted-foreground p-4">
              Account settings content.
            </p>
          </TabsContent>
          <TabsContent value="tab2">
            <p className="text-sm text-muted-foreground p-4">
              Password settings content.
            </p>
          </TabsContent>
          <TabsContent value="tab3">
            <p className="text-sm text-muted-foreground p-4">
              General settings content.
            </p>
          </TabsContent>
        </Tabs>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Orientation: Vertical (Default)</PageSectionHeader>
        <Tabs defaultValue="tab1" orientation="vertical">
          <TabsList>
            <TabsTrigger value="tab1">Profile</TabsTrigger>
            <TabsTrigger value="tab2">Notifications</TabsTrigger>
            <TabsTrigger value="tab3">Billing</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <p className="text-sm text-muted-foreground p-4">
              Profile settings content.
            </p>
          </TabsContent>
          <TabsContent value="tab2">
            <p className="text-sm text-muted-foreground p-4">
              Notifications settings content.
            </p>
          </TabsContent>
          <TabsContent value="tab3">
            <p className="text-sm text-muted-foreground p-4">
              Billing settings content.
            </p>
          </TabsContent>
        </Tabs>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Orientation: Vertical (Line)</PageSectionHeader>
        <Tabs defaultValue="tab1" orientation="vertical">
          <TabsList variant="line">
            <TabsTrigger value="tab1">Profile</TabsTrigger>
            <TabsTrigger value="tab2">Notifications</TabsTrigger>
            <TabsTrigger value="tab3">Billing</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <p className="text-sm text-muted-foreground p-4">
              Profile settings content.
            </p>
          </TabsContent>
          <TabsContent value="tab2">
            <p className="text-sm text-muted-foreground p-4">
              Notifications settings content.
            </p>
          </TabsContent>
          <TabsContent value="tab3">
            <p className="text-sm text-muted-foreground p-4">
              Billing settings content.
            </p>
          </TabsContent>
        </Tabs>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>State: Disabled Trigger</PageSectionHeader>
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Active</TabsTrigger>
            <TabsTrigger value="tab2" disabled>
              Disabled
            </TabsTrigger>
            <TabsTrigger value="tab3">Active</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <p className="text-sm text-muted-foreground p-4">
              Active tab content.
            </p>
          </TabsContent>
          <TabsContent value="tab3">
            <p className="text-sm text-muted-foreground p-4">
              Another active tab content.
            </p>
          </TabsContent>
        </Tabs>
      </PageSection>
    </div>
  );
}
