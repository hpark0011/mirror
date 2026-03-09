import { Icon } from "@feel-good/ui/components/icon";

type ContentCategoryFilterBadgesProps = {
  selectedCategories: string[];
  onRemove: (name: string) => void;
  onClearFilter: () => void;
};

export function ContentCategoryFilterBadges({
  selectedCategories,
  onRemove,
  onClearFilter,
}: ContentCategoryFilterBadgesProps) {
  if (selectedCategories.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 px-px py-0.5">
      {selectedCategories.map((category) => (
        <div
          key={category}
          className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 pr-1 text-xs"
        >
          {category}
          <button
            onClick={() => onRemove(category)}
            className="flex items-center justify-center text-muted-foreground transition-colors hover:text-information"
            aria-label={`Remove ${category} filter`}
          >
            <Icon name="XmarkIcon" className="size-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onClearFilter}
        className="group flex h-[22px] items-center justify-center gap-px rounded-md border border-border-subtle/50 px-1.5 py-0.5 pl-px transition-colors dark:border-border"
        aria-label="Clear category filters"
      >
        <Icon
          name="XmarkCircleFillIcon"
          className="size-4.5 text-muted-foreground group-hover:text-information"
        />
        <span className="text-xs text-muted-foreground group-hover:text-information">
          Clear
        </span>
      </button>
    </div>
  );
}
