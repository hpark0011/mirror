import { ReactNode } from "react";

type DescriptionItem = { label: string; value: ReactNode };

interface DescriptionListProps {
  items: DescriptionItem[];
  labelWidthClassName?: string; // e.g., "w-24 sm:w-28"
  className?: string;
}

export function DescriptionList({
  items,
  labelWidthClassName = "w-24 sm:w-28",
  className,
}: DescriptionListProps) {
  return (
    <dl className={className ? className : "space-y-0"}>
      {items.map((item, index) => (
        <div key={index} className='flex items-start gap-2'>
          <dt
            className={
              labelWidthClassName +
              " shrink-0 text-xs text-text-tertiary h-[24px] flex items-center"
            }
          >
            {item.label}
          </dt>
          <dd className='min-w-0 flex-1 text-xs text-text-tertiary'>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
