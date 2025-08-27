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
        "flex justify-between items-center py-2 bg-transparent fixed top-0 w-full px-4 pl-5",
        className
      )}
    >
      {children}
    </div>
  );
};

export const HeaderLogo = ({ title }: { title: string }) => {
  return (
    <div className='flex items-center gap-1.5'>
      <Image
        src='/delphi.svg'
        alt='Delphi logo'
        width={20}
        height={20}
        priority
      />
      <h1 className='text-xl font-medium pb-[1px]'>{title}</h1>
    </div>
  );
};

export const HeaderMenu = ({ children }: { children: React.ReactNode }) => {
  return <div className='flex gap-0'>{children}</div>;
};
