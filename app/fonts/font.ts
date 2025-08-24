import localFont from "next/font/local";

export const Inter = localFont({
  src: [
    {
      path: "./InterVariable.ttf",
      style: "normal",
    },
    {
      path: "./InterVariable-Italic.ttf",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--font-inter",
});

export const InstrumentSerif = localFont({
  src: [
    {
      path: "./InstrumentSerif-Regular.ttf",
      style: "normal",
    },
    {
      path: "./InstrumentSerif-Italic.ttf",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--font-instrument-serif",
});
