import {
  buildProfileSectionHref,
  DEFAULT_PROFILE_SECTION,
} from "@feel-good/convex/convex/content/href";

const CHAT_SEARCH_PARAM_KEYS = ["chat", "conversation", "chatMode"] as const;

const PROFILE_ROOT_PATTERN = /^\/@([^/]+)\/?$/;
const PROFILE_CHAT_PATTERN = /^\/@([^/]+)\/chat(?:\/.*)?$/;
const PROFILE_PATH_PATTERN = /^\/@([^/]+)(?:\/|$)/;

export function getProfileRouteRedirect(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  const rootMatch = PROFILE_ROOT_PATTERN.exec(pathname);
  if (rootMatch) {
    return buildProfileSectionHref(rootMatch[1], DEFAULT_PROFILE_SECTION);
  }

  const chatRouteMatch = PROFILE_CHAT_PATTERN.exec(pathname);
  if (chatRouteMatch) {
    return buildProfileSectionHref(chatRouteMatch[1], DEFAULT_PROFILE_SECTION);
  }

  const hasChatState = CHAT_SEARCH_PARAM_KEYS.some((key) =>
    searchParams.has(key),
  );
  if (!hasChatState) return null;

  const profileMatch = PROFILE_PATH_PATTERN.exec(pathname);
  return profileMatch
    ? buildProfileSectionHref(profileMatch[1], DEFAULT_PROFILE_SECTION)
    : null;
}
