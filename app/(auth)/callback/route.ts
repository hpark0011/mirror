import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { createAuthCallbackService } from "@/lib/services/auth-callback.service";
import { getSupabaseServerClient } from "@/utils/supabase/client/supabase-server";

import { PATHS } from "@/config/paths.config";

export async function GET(request: NextRequest) {
  const service = createAuthCallbackService(await getSupabaseServerClient());

  const { nextPath } = await service.exchangeCodeForSession(request, {
    redirectPath: PATHS.app.dashboard,
  });

  return redirect(nextPath);
}
