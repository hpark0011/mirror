import { fontVariables } from "@/app/fonts/font";
import { SidebarLayout } from "@/components/sidebar-layout";
import { RootProvider } from "@/providers/root-provider";
import "@/styles/globals.css";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "UI Factory",
  description: "Component design and preview tool for Feel Good apps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVariables} antialiased`}>
        <RootProvider>
          <SidebarLayout>{children}</SidebarLayout>
        </RootProvider>
      </body>
    </html>
  );
}
