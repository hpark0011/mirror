import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { DEFAULT_PROFILE_CONTENT_KIND } from "@/features/content/types";

const PUBLIC_ROUTES = ["/", "/sign-in", "/sign-up"];
const AUTH_ROUTES = ["/sign-in", "/sign-up"];
const BARE_PROFILE_PATH = /^\/@[^/]+\/?$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow API routes and static files
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  // Bare /@username → default content tab. The [username] layout discards
  // page.tsx's children slot (parallel routes own the render tree), so a
  // page-level redirect can't fire — middleware is the only place this works.
  if (BARE_PROFILE_PATH.test(pathname)) {
    const trimmed = pathname.replace(/\/$/, "");
    const target = new URL(
      `${trimmed}/${DEFAULT_PROFILE_CONTENT_KIND}`,
      request.url,
    );
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target);
  }

  const sessionCookie = getSessionCookie(request);
  const isAuthenticated = !!sessionCookie;

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect unauthenticated users from protected routes
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith("/@");
  if (!isAuthenticated && !isPublicRoute) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
