import "@/styles/globals.css";
import type { Metadata } from "next";
import { InsightsHeader } from "./_components/insights-header";

export const metadata: Metadata = {
  title: "Insights",
  description: "Delphi insights",
};

export default function InsightsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='flex flex-col items-center h-screen relative pt-[48px]'>
      <InsightsHeader />
      {children}
    </div>
  );
}
