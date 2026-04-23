import type { DockConfig } from "@feel-good/features/dock/lib/types";
import { ChartBarFillIcon, HouseFillIcon } from "@feel-good/icons";

export const APP_DOCK_CONFIG: DockConfig = {
  placement: "bottom",
  defaultAppId: "home",
  apps: [
    {
      id: "home",
      name: "Home",
      icon: HouseFillIcon,
      route: "/",
      order: 1,
    },
    {
      id: "dashboard",
      name: "Dashboard",
      icon: ChartBarFillIcon,
      route: "/dashboard",
      order: 2,
    },
  ],
};
