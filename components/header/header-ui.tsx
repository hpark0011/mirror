"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import type React from "react";

export const HeaderContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "flex justify-between items-center py-2 bg-transparent fixed top-0 w-full px-4",
        className
      )}
    >
      {children}
    </div>
  );
};

export const HeaderLogo = () => {
  return (
    <div className='flex items-center gap-1.5 cursor-pointer'>
      <Image
        src='/gb-logo-light.png'
        alt='GraphBase logo'
        width={120}
        height={64}
        priority
        className='h-6 w-auto dark:hidden'
      />
      <Image
        src='/gb-logo-dark.png'
        alt='GraphBase logo'
        width={120}
        height={64}
        priority
        className='hidden h-6 w-auto dark:inline'
      />
    </div>
  );
};

export const HeaderMenu = ({ children }: { children: React.ReactNode }) => {
  return <div className='flex gap-0'>{children}</div>;
};
