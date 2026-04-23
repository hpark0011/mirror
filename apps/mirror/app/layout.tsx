import { InstrumentSerif, Inter } from "@/app/fonts/font";
import { AppDockConnector } from "@/features/dock";
import { RootProvider } from "@/providers/root-provider";
import { Toaster } from "@feel-good/ui/primitives/sonner";
import "@/styles/globals.css";
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

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
        <RootProvider>
          {children}

          <AppDockConnector />
          <Toaster />
        </RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
