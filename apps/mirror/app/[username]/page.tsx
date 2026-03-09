import type { Metadata } from "next";
import { userAgentFromString } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
import { isReservedUsername } from "@/lib/reserved-usernames";
import {
  DEFAULT_PROFILE_CONTENT_KIND,
  getContentHref,
} from "@/features/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;

  if (isReservedUsername(username)) {
    return {};
  }

  const profile = await fetchAuthQuery(api.users.queries.getByUsername, {
    username,
  });

  if (!profile) {
    return {};
  }

  const displayName = profile.name || `@${profile.username ?? username}`;
  const description = profile.bio || `${displayName}'s profile on Mirror`;

  return {
    title: displayName,
    description,
    openGraph: {
      title: displayName,
      description,
      ...(profile.avatarUrl && { images: [{ url: profile.avatarUrl }] }),
    },
  };
}

/**
 * Profile root page — dual-role design:
 *
 * Desktop: Returns `null` so the content panel starts collapsed (the layout
 *   still renders the profile shell via parallel routes). Crawlers still
 *   receive metadata from `generateMetadata` above.
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
