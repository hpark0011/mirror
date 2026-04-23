import { cn } from "@feel-good/utils/cn";

function SidebarTriggerVerticalLine({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      className={cn(
        "relative",
        "w-[3px]",
        "transition-all duration-100",
        "bg-gray-2 dark:bg-gray-8 shadow-[0px_3px_3px_-1px_rgba(0,0,0,0.1)] dark:shadow-[0px_3px_3px_-1px_rgba(0,0,0,0.4)] overflow-visible group-hover:bg-green-2 dark:group-hover:bg-gray-11",
        isOpen
          ? "left-[1.5px] w-[6px] h-[calc(100%-3px)] rounded-[2px]"
          : "h-[calc(100%-4px)] left-[1.5px] rounded-full",
      )}
    />
  );
}

export function SidebarTrigger({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center",
        "w-[15px] h-3.5",
        "bg-muted hover:bg-green-9 dark:hover:bg-green-8",
        "rounded-[4px] overflow-visible",
        "group transition-all duration-100",
      )}
    >
      <SidebarTriggerVerticalLine isOpen={isOpen} />
    </div>
  );
}
