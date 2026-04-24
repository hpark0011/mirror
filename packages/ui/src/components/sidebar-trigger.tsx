import { cn } from "@feel-good/utils/cn";

type SidebarTriggerAlign = "left" | "right";

function SidebarTriggerVerticalLine({
  isOpen,
  align,
}: {
  isOpen: boolean;
  align: SidebarTriggerAlign;
}) {
  return (
    <div
      className={cn(
        "relative",
        "w-[4px]",
        "transition-all duration-100",
        "bg-gray-2 dark:bg-gray-8 shadow-[0px_3px_3px_-1px_rgba(0,0,0,0.1)] dark:shadow-[0px_3px_3px_-1px_rgba(0,0,0,0.4)] overflow-visible group-hover:bg-green-2 dark:group-hover:bg-gray-11 [corner-shape:superellipse(1.2)]",
        align === "left" ? "left-[1.5px]" : "right-[1.5px]",
        isOpen
          ? "w-[6px] h-[calc(100%-3px)] rounded-[2px]"
          : "h-[calc(100%-4px)] rounded-full",
      )}
    />
  );
}

export function SidebarTrigger({
  isOpen,
  align = "left",
}: {
  isOpen: boolean;
  align?: SidebarTriggerAlign;
}) {
  return (
    <div
      className={cn(
        "flex items-center",
        align === "right" && "justify-end",
        "w-[16px] h-4",
        "bg-muted hover:bg-green-9 dark:hover:bg-green-8",
        "rounded-[4px] overflow-visible [corner-shape:superellipse(1.2)]",
        "group transition-all duration-100",
      )}
    >
      <SidebarTriggerVerticalLine isOpen={isOpen} align={align} />
    </div>
  );
}
