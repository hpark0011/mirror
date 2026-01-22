import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/client/middleware-client";

export async function middleware(request: NextRequest) {
  // Update the session using the existing updateSession function
  // This handles session refresh and cookie management
  return await updateSession(request);
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
