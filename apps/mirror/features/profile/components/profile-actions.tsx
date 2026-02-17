import { ShinyButton } from "@feel-good/ui/components/shiny-button";
import { Icon, type IconName } from "@feel-good/ui/components/icon";
import { toast } from "sonner";

type ProfileAction = {
  label: string;
  icon: IconName;
  iconClassName?: string;
};

const PROFILE_ACTIONS: ProfileAction[] = [
  { label: "Text", icon: "BubbleLeftFillIcon", iconClassName: "size-5.5" },
  { label: "Video", icon: "VideoFillIcon", iconClassName: "size-5.5" },
  { label: "Voice", icon: "WaveformIcon", iconClassName: "size-6" },
];

const shinyButtonClass =
  "w-11 h-11 rounded-[20px] [corner-shape:superellipse(1.3)]";
const shinyButtonShadowClass =
  "rounded-[20px] [corner-shape:superellipse(1.3)]";

type ProfileActionsProps = {
  onVideoClick?: () => void;
};

export function ProfileActions({ onVideoClick }: ProfileActionsProps) {
  const handleClick = (label: string) => {
    if (label === "Video") {
      onVideoClick?.();
    } else {
      toast("Coming soon", { description: `${label} conversations are not yet available.` });
    }
  };

  return (
    <div className="flex gap-2.5 items-center">
      {PROFILE_ACTIONS.map(({ label, icon, iconClassName }) => (
        <div key={label} className="flex flex-col gap-2">
          <ShinyButton
            className={shinyButtonClass}
            shadowClassName={shinyButtonShadowClass}
            onClick={() => handleClick(label)}
          >
            <Icon name={icon} className={iconClassName} />
          </ShinyButton>
          <span className="text-sm text-center text-muted-foreground">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
