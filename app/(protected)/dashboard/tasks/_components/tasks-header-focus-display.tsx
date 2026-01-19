import { cn } from "@/lib/utils";

interface TasksHeaderFocusDisplayProps {
  todayFocus: string | null;
  onClick: () => void;
}

export function TasksHeaderFocusDisplay({
  todayFocus,
  onClick,
}: TasksHeaderFocusDisplayProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='bg-card shadow-xs border-border-highlight dark:border-white/2 border rounded-sm h-[24px] hover:bg-base transition-all duration-200 ease-out cursor-pointer scale-100 flex items-center translate-y-[0px] hover:translate-y-[-1px] hover:shadow-lg overflow-hidden text-[14px]'
    >
      <div className='text-text-muted font-medium px-2 h-full flex items-center'>
        {new Date().toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </div>
      <div className='w-px self-stretch mx-0 bg-border-light' />
      <span
        className={cn(
          "hover:bg-neutral-100 dark:hover:bg-neutral-700 px-2 h-full flex items-center dark:hover:text-white/70",
          todayFocus
            ? "text-text-primary font-medium"
            : "text-text-muted font-[480]"
        )}
      >
        {todayFocus || "Set today's focus"}
      </span>
    </button>
  );
}
