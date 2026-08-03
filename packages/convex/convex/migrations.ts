import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import schema from "./schema";

export const migrations = new Migrations(components.migrations, { schema });

/** Generic runner retained for progressive, dry-run-first data migrations. */
export const run = migrations.runner();
