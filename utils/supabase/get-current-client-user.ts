import { getSupabaseBrowserClient } from "@/utils/supabase/client/supabase-client";

export const getCurrentClientUser = async () => {
  const supabase = getSupabaseBrowserClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Not authenticated");

  return user;
};
