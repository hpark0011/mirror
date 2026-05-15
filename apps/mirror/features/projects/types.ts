import { type FunctionReturnType } from "convex/server";
import { type api } from "@feel-good/convex/convex/_generated/api";

export type Project = NonNullable<
  FunctionReturnType<typeof api.projects.queries.getByUsername>
>[number];
