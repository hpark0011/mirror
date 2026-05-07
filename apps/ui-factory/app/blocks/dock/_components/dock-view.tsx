"use client";

import { Divider } from "@/components/divider";
import { Icon } from "@feel-good/ui/components/icon";
import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import { AppDock } from "@feel-good/features/dock/blocks";
import { type DockConfig } from "@feel-good/features/dock/lib";
import {
  BubbleLeftFillIcon,
  CheckListIcon,
  DocFillIcon,
  PersonCropRectangleStackFillIcon,
} from "@feel-good/icons";
import { cn } from "@feel-good/ui/lib/utils";

const DocIcon = ({ className }: { className?: string }) => (
  <DocFillIcon className={cn("size-6.5", className)} />
);
const ThreadIcon = ({ className }: { className?: string }) => (
  <BubbleLeftFillIcon className={cn("size-6.5", className)} />
);
const TaskIcon = ({ className }: { className?: string }) => (
  <CheckListIcon className={cn("size-6.5", className)} />
);
const AgentIcon = ({ className }: { className?: string }) => (
  <PersonCropRectangleStackFillIcon className={cn("size-6", className)} />
);

const dockConfig: DockConfig = {
  placement: "bottom",
  defaultAppId: "docs",
  apps: [
    { id: "docs", name: "Doc Viewer", icon: DocIcon, route: "/docs", order: 1 },
    {
      id: "threads",
      name: "Threads",
      icon: ThreadIcon,
      route: "/threads",
      order: 2,
    },
    {
      id: "tasks",
      name: "Task Board",
      icon: TaskIcon,
      route: "/tasks",
      order: 3,
    },
    {
      id: "agents",
      name: "Agent Book",
      icon: AgentIcon,
      route: "/agents",
      order: 0,
    },
  ],
};

export function DockView() {
  return (
    <div className="flex flex-col w-full">
      <Divider />
      <PageSection>
        <PageSectionHeader>App Dock</PageSectionHeader>
        <div className="flex items-center gap-1 mt-[200px] mx-auto h-full">
          <Icon
            name="ArrowDownCircleFillIcon"
            className="size-6 text-primary"
          />
          <p className="text-[15px] text-foreground w-full">
            Hover near the bottom of the screen to reveal the dock.
          </p>
        </div>
      </PageSection>

      <AppDock
        config={dockConfig}
        onAppClick={(appId) => console.log("Clicked:", appId)}
      />
    </div>
  );
}
