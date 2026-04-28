import { userAgentFromString } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEFAULT_PROFILE_CONTENT_KIND,
  getContentHref,
} from "@/features/content";

/**
 * Profile root page — dual-role design:
 *
 * Desktop: Returns `null` so the content panel starts collapsed (the layout
 *   still renders the profile shell via parallel routes). Metadata is emitted
 *   by the layout's `generateMetadata`.
 *
 * Mobile: Redirects to the default content kind (e.g. articles) since
 *   mobile doesn't have a collapsible panel UX.
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  const resolvedSearchParams = await searchParams;
  const nextSearchParams = new URLSearchParams();

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      nextSearchParams.set(key, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => nextSearchParams.append(key, entry));
    }
  });

  const requestHeaders = await headers();
  const userAgent = userAgentFromString(
    requestHeaders.get("user-agent") ?? undefined,
  );
  const isMobileUserAgent =
    userAgent.device.type === "mobile" || userAgent.device.type === "tablet";

  if (!isMobileUserAgent) {
    return null;
  }

  const href = getContentHref(username, DEFAULT_PROFILE_CONTENT_KIND);
  const queryString = nextSearchParams.toString();

  redirect(queryString ? `${href}?${queryString}` : href);
}
