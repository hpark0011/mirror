import { type FunctionReturnType } from "convex/server";
import { type api } from "@feel-good/convex/convex/_generated/api";

/** Raw API response from getByUsername (public view) */
type PublicProfileResponse = NonNullable<
  FunctionReturnType<typeof api.users.queries.getByUsername>
>;

/** Raw API response from getCurrentProfile (authenticated, includes email) */
export type UserProfile = NonNullable<
  FunctionReturnType<typeof api.users.queries.getCurrentProfile>
>;

/** What profile components receive. Optionals coalesced by the layout. */
export type Profile = {
  _id: PublicProfileResponse["_id"];
  authId: PublicProfileResponse["authId"];
  username: string;
  name: string;
  tagline: string;
  avatarUrl: PublicProfileResponse["avatarUrl"];
  defaultProfileSection: PublicProfileResponse["defaultProfileSection"];
  media?: {
    video: string;
    poster: string;
  };
};
