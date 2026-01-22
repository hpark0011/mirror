import type { SupabaseClient, User } from "@supabase/supabase-js";
import { PATHS } from "@/config/paths.config";

export async function requireUser(client: SupabaseClient): Promise<
  | {
      data: User;
      error: null;
    }
  | { data: null; error: AuthenticationError; redirectTo: string }
> {
  const { data, error } = await client.auth.getUser();

  if (!data.user || error) {
    return {
      data: null,
      error: new AuthenticationError(),
      redirectTo: PATHS.auth.signIn,
    };
  }

  return { data: data.user, error: null };
}

class AuthenticationError extends Error {
  constructor() {
    super(`Authentication required`);
  }
}
