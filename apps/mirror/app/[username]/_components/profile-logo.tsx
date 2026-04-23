"use client";

import { MirrorLogo } from "@/components/mirror-logo";
import { MirrorLogoMenu } from "@/components/mirror-logo-menu";
import { useProfileRouteData } from "../_providers/profile-route-data-context";

export function ProfileLogo() {
  const { isOwner } = useProfileRouteData();
  return isOwner ? <MirrorLogoMenu /> : <MirrorLogo />;
}
