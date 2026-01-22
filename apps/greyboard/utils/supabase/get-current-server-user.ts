import { getSupabaseServerClient } from "@/utils/supabase/client/supabase-server";

export async function getCurrentServerUser() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Not authenticated");

  return user;
}
