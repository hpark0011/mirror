import { type ComponentType } from "react";
import { z } from "zod";

export const dockPlacementSchema = z.enum(["bottom"]);

export const dockAppSchema = z.object({
  id: z.string().min(1, "App ID is required"),
  name: z.string().min(1, "App name is required"),
  route: z.string().min(1, "App route is required"),
  order: z.number().int().nonnegative("Order must be a non-negative integer"),
  icon: z.custom<ComponentType<{ className?: string }>>(
    (val) => typeof val === "function",
    "Icon must be a React component",
  ),
});

export const dockConfigSchema = z.object({
  placement: dockPlacementSchema,
  apps: z.array(dockAppSchema),
  defaultAppId: z.string().min(1, "Default app ID is required"),
});

export type DockPlacementSchema = z.infer<typeof dockPlacementSchema>;
export type DockAppSchema = z.infer<typeof dockAppSchema>;
export type DockConfigSchema = z.infer<typeof dockConfigSchema>;
