import { cn } from "@/lib/utils";
import React from "react";

export function TrendGroupWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className='border border-extra-light rounded-2xl flex flex-col w-full bg-neutral-100 overflow-hidden'>
      {children}
    </div>
  );
}

export function TrendBodyWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-6 w-full py-2.5 px-4 pb-2", className)}
    >
      {children}
    </div>
  );
}

export function TrendItem({ children }: { children: React.ReactNode }) {
  return (
    <div className='text-text-strong text-sm w-full flex items-center justify-between'>
      {children}
    </div>
  );
}

export function ActionCardWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl w-full border p-3 py-2.5 flex flex-col justify-between items-start relative  transition-all duration-200 translate-y-0  scale-100 ease-out group bg-white/30 border-white/30  gap-0 inset-shadow-none hover:bg-base hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.9),_0_14px_14px_-6px_rgba(0,0,0,0.3) hover:translate-y-[-1px] hover:border-opacity-100 hover:scale-[1.02] cursor-pointer gap-2 justify-start",
        className
      )}
    >
      {children}
    </div>
  );
}

export function InsightsCardWrapper({
  children,
  isHoverable = true,
  className,
  orientation = "horizontal",
}: {
  children: React.ReactNode;
  isHoverable?: boolean;
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      className={cn(
        "rounded-xl w-full p-3 py-2 flex flex-row justify-between items-center relative  transition-all duration-200 translate-y-0 bg-white scale-100 ease-out group gap-1 inset-shadow-none",
        orientation === "vertical" && "flex-col items-start",
        className,
        isHoverable &&
          "hover:bg-base hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.9),_0_14px_14px_-6px_rgba(0,0,0,0.3) hover:translate-y-[-1px] hover:border-opacity-100 hover:scale-[1.02] "
      )}
    >
      {children}
    </div>
  );
}

export function InsightsCardLabel({ children }: { children: React.ReactNode }) {
  return <div className='text-sm text-text-tertiary'>{children}</div>;
}

export function InsightsCardValueWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='flex flex-row items-baseline justify-between gap-2'>
      {children}
    </div>
  );
}

export function InsightsCardValue({ children }: { children: React.ReactNode }) {
  return <div className='text-xl font-medium'>{children}</div>;
}

export function GrowthRate({
  children,
  isPositive,
}: {
  children: React.ReactNode;
  isPositive: boolean;
}) {
  return (
    <div
      className={cn(
        "text-sm text-text-tertiary",
        isPositive ? "text-green-600" : "text-red-600"
      )}
    >
      {isPositive ? "+" : "-"}
      {children}
    </div>
  );
}

export function InsightHeaderBadgeWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1 text-[12px] rounded-md border border-extra-light w-fit pr-2 h-[26px] hover:bg-neutral-100",
        className
      )}
    >
      {children}
    </div>
  );
}
