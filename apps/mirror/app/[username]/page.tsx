import { redirect } from "next/navigation";
import { CONTENT_KINDS, getContentHref } from "@/features/content";

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

  const href = getContentHref(username, CONTENT_KINDS[0]);
  const queryString = nextSearchParams.toString();

  redirect(queryString ? `${href}?${queryString}` : href);
}
