"use client";

import { Button } from "@feel-good/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { Icon } from "@feel-good/ui/components/icon";
import { useTranslation } from "react-i18next";

type ConfigureProfileButtonProps = {
  onClick: () => void;
};

export function ConfigureProfileButton({
  onClick,
}: ConfigureProfileButtonProps) {
  const { t } = useTranslation();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("profile.configureButton.ariaLabel", { defaultValue: "Configure profile" })}
          onClick={onClick}
          className="rounded-full [corner-shape:superellipse(1.0)] hover:[&_svg]:text-secondary-foreground [&_svg]:text-secondary-foreground [&_svg]:size-5.5"
        >
          <Icon name="SparkleIcon" className="text-icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("profile.configureButton.tooltip", { defaultValue: "Configure profile" })}</TooltipContent>
    </Tooltip>
  );
}
