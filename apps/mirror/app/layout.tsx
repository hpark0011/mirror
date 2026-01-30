import { InstrumentSerif, Inter } from "@/app/fonts/font";
import { RootProvider } from "@/providers/root-provider";
import "@/styles/globals.css";
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mirror",
  description: "Your personal mirror for productivity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${Inter.variable} ${InstrumentSerif.variable} ${geistMono.variable} antialiased`}
      >
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
