export type Profile = {
  name: string;
  bio: string;
  media: {
    video: string;
    poster: string;
  };
};

export const MOCK_PROFILE: Profile = {
  name: "Rick Rubin",
  bio: "Rick Rubin has been a singular, transformative creative muse for artists across genres and generations — from the Beastie Boys to Johnny Cash, from Public Enemy to the Red Hot Chili Peppers, from Adele to Jay-Z.",
  media: {
    video: "/portrait-video.mp4",
    poster: "/rr.webp",
  },
};
