import "server-only";

import { redirect } from "next/navigation";
import type { Route } from "next";

import type { User } from "@supabase/supabase-js";

import { z } from "zod";

import { requireUser } from "@/utils/require-user";
import { getSupabaseServerClient } from "@/utils/supabase/client/supabase-server";

import { zodParseFactory } from "@/utils/zod-parse-factory";

/**
 * @name enhanceAction
 * @description Enhance an action with schema and auth checks
 */
export function enhanceAction<
  Args,
  Response,
  Config extends {
    auth?: boolean;
    schema?: z.ZodTypeAny;
  },
>(
  fn: (
    params: Config["schema"] extends z.ZodTypeAny
      ? z.infer<Config["schema"]>
      : Args,
    user: Config["auth"] extends false ? undefined : User
  ) => Response | Promise<Response>,
  config: Config
) {
  return async (
    params: Config["schema"] extends z.ZodTypeAny
      ? z.infer<Config["schema"]>
      : Args
  ) => {
    type UserParam = Config["auth"] extends false ? undefined : User;

    const requireAuth = config.auth ?? true;
    let user: UserParam = undefined as UserParam;

    // validate the schema passed in the config if it exists
    const data = config.schema
      ? zodParseFactory(config.schema)(params)
      : params;

    // verify the user is authenticated if required
    if (requireAuth) {
      const client = await getSupabaseServerClient();

      // verify the user is authenticated if required
      const auth = await requireUser(client);

      // If the user is not authenticated, redirect to the specified URL.
      if (!auth.data) {
        const errorAuth = auth as {
          data: null;
          error: Error;
          redirectTo: string;
        };
        redirect(errorAuth.redirectTo as Route);
      }

      user = auth.data as UserParam;
    }

    return fn(
      data as Config["schema"] extends z.ZodTypeAny
        ? z.infer<Config["schema"]>
        : Args,
      user
    );
  };
}
