"use client";

import Image from "next/image";
import type React from "react";
import { cn } from "@/lib/utils";

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
        "flex justify-between items-center h-12 bg-transparent fixed top-0 w-full px-4",
        className
      )}
    >
      {children}
    </div>
  );
};

export const HeaderLogoContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className='p-[4px] px-[5px] border duration-200 ease-out transition-all border-background hover:border-border-highlight hover:shadow-[inset_0_0_4px_1px_rgba(255,255,255,1),_0_4px_16px_-8px_rgba(0,0,0,0.2)] hover:dark:shadow-[inset_0_0_4px_1px_rgba(0,0,0,1),_0_4px_16px_-8px_rgba(255,255,255,0.2)] dark:hover:border-neutral-800 rounded-full bg-gradient-to-t from-black/0 to-white/0 hover:from-black/15 hover:to-white hover:dark:from-white/30 hover:dark:to-black'>
      {children}
    </div>
  );
};

export const HeaderLogo = () => {
  return (
    <HeaderLogoContainer>
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
    </HeaderLogoContainer>
  );
};

export const HeaderMenu = ({ children }: { children: React.ReactNode }) => {
  return <div className='flex gap-0'>{children}</div>;
};
