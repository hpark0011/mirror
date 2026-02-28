import { ShinyButton } from "@feel-good/ui/components/shiny-button";
import { Icon, type IconName } from "@feel-good/ui/components/icon";
import { Button } from "@feel-good/ui/primitives/button";
import { cn } from "@feel-good/ui/lib/utils";
import { motion } from "framer-motion";

type ProfileAction = {
  label: string;
  icon: IconName;
  iconClassName?: string;
  handler?: () => void;
};

const shinyButtonClass =
  "w-11 h-11 rounded-[20px] [corner-shape:superellipse(1.3)]";
const shinyButtonShadowClass =
  "rounded-[20px] [corner-shape:superellipse(1.3)]";

type ProfileActionsProps = {
  isEditing?: boolean;
  onOpenChat?: () => void;
  onOpenVideoCall?: () => void;
  onEdit?: () => void;
};

export function EditableProfileActions({
  isEditing,
  onOpenChat,
  onOpenVideoCall,
  onEdit,
}: ProfileActionsProps) {
  const actions: ProfileAction[] = [
    {
      label: "Text",
      icon: "BubbleLeftFillIcon",
      iconClassName: "size-5.5",
      handler: onOpenChat,
    },
    {
      label: "Video",
      icon: "VideoFillIcon",
      iconClassName: "size-5.5",
      handler: onOpenVideoCall,
    },
    { label: "Voice", icon: "WaveformIcon", iconClassName: "size-6" },
  ];

  return (
    <div className="flex flex-col w-full justify-center items-center gap-1">
      <label className="w-full text-start px-0.5 text-sm text-muted-foreground">
        <motion.div
          initial={{ opacity: 0, backgroundColor: "rgba(255,255,255,0)" }}
          animate={{ opacity: isEditing ? "100%" : "0%" }}
          transition={{ type: "spring", stiffness: 300, damping: 40 }}
          className="text-muted-foreground px-1"
        >
          Actions
        </motion.div>
      </label>
      <div
        className={`group/actions flex gap-2.5 items-center p-6 pb-1.5 pt-2 max-w-md w-full justify-center rounded-xl relative ${
          isEditing ? "border hover:bg-gray-1/30" : "border border-transparent"
        }`}
      >
        {isEditing && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Edit actions"
            onClick={onEdit}
            className="absolute top-1.5 right-1.5 rounded-full [corner-shape:superellipse(1.0)] opacity-0 group-hover/actions:opacity-100 transition-opacity [&_svg]:size-5.5"
          >
            <Icon name="PencilIcon" />
          </Button>
        )}
        {actions.map(({ label, icon, iconClassName, handler }) => (
          <div
            key={label}
            className={cn(
              "flex flex-col gap-2",
              !handler && "opacity-40 pointer-events-none",
            )}
          >
            <ShinyButton
              className={shinyButtonClass}
              shadowClassName={shinyButtonShadowClass}
              onClick={() => handler?.()}
            >
              <Icon name={icon} className={iconClassName} />
            </ShinyButton>
            <span className="text-sm text-center text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
