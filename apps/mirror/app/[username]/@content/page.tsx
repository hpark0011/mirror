import { notFound, redirect } from "next/navigation";
import { api } from "@feel-good/convex/convex/_generated/api";
import {
  buildProfileSectionHref,
  DEFAULT_PROFILE_SECTION,
} from "@feel-good/convex/convex/content/href";
import { fetchAuthQuery } from "@/lib/auth-server";

function appendSearchParams(
  href: string,
  params: Record<string, string | string[] | undefined>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, item);
      }
    } else if (value !== undefined) {
      search.set(key, value);
    }
  }

  const queryString = search.toString();
  return queryString ? `${href}?${queryString}` : href;
}

export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const profile = await fetchAuthQuery(api.users.queries.getByUsername, {
    username,
  });

  if (!profile) notFound();

  const defaultSection =
    profile.defaultProfileSection ?? DEFAULT_PROFILE_SECTION;

  redirect(
    appendSearchParams(
      buildProfileSectionHref(username, defaultSection),
      query,
    ),
  );
}
