import type { IconName } from "@/components/ui/icon";

export type InsightActionType = "contact" | "create-content" | "add-data";

type InsightVariant = {
  icon: IconName;
  iconColorClasses: string; // applied to the header icon (e.g., text + bg color)
  headerText: string;
  badgeIcon?: IconName; // optional icon for the badge area when needed
};

export const INSIGHT_VARIANTS: Record<InsightActionType, InsightVariant> = {
  contact: {
    icon: "HandWaveFillIcon",
    iconColorClasses: "text-blue-500 bg-blue-100",
    headerText: "Reach out to",
  },
  "create-content": {
    icon: "SquareTextSquareFillIcon",
    badgeIcon: "SquareTextSquareFillIcon",
    iconColorClasses: "text-pink-600 bg-pink-100",
    headerText: "Create content on",
  },
  "add-data": {
    icon: "CylinderSplit1x2FillIcon",
    badgeIcon: "CylinderSplit1x2FillIcon",
    iconColorClasses: "text-orange-500 bg-orange-100",
    headerText: "Set",
  },
};
