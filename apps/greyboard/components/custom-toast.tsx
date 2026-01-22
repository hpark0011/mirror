"use client";

import React from "react";
import { toast as sonnerToast } from "sonner";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { cn } from "@/lib/utils";

export function customToast(toast: Omit<ToastProps, "id">) {
  return sonnerToast.custom((id) => (
    <Toast
      id={id}
      title={toast.title}
      description={toast.description}
      button={toast.button}
      type={toast.type}
    />
  ));
}

const getToastIcon = (type: ToastProps["type"]) => {
  const iconMap = {
    error: "ExclamationmarkTriangleFillIcon",
    success: "CheckedCircleFillIcon",
    warning: "ExclamationmarkTriangleFillIcon",
    info: "InfoCircleFillIcon",
  } as const;

  return iconMap[type];
};

/** A fully custom toast that still maintains the animations and interactions. */
function Toast(props: ToastProps) {
  const { title, description, button, id, type } = props;

  return (
    <div
      className={cn(
        "flex items-center shadow-[0_16px_24px_-16px_rgba(0,0,0,0.2)] border-t-[1px] border-white/90 dark:border-white/5 bg-gradient-to-b from-[#F1F1F2] to-[#EDEDEF] dark:from-[#0F0F0F] dark:to-[#0D0D0D] py-4 px-5 relative",
        description ? "rounded-3xl" : "rounded-xl"
      )}
    >
      <div className='flex flex-1 items-center font-inter'>
        <div className='w-full'>
          <div className='flex items-center gap-0.5 -ml-0.5'>
            <Icon
              name={getToastIcon(type)}
              className='w-5 h-5 text-text-primary'
            />
            <p className='text-sm font-[550] text-text-primary'>{title}</p>
          </div>
          {description && (
            <p className='mt-1 text-sm text-text-tertiary font-[480] leading-[120%]'>
              {description}
            </p>
          )}
        </div>
      </div>
      <div className='ml-4 shrink-0 font-medium focus:ring-2 focus:outline-hidden'>
        {button && (
          <Button
            size='sm'
            onClick={() => {
              button.onClick();
              sonnerToast.dismiss(id);
            }}
          >
            <span className='text-text-primary-inverse font-inter not-italic text-xs'>
              {button.label}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}

interface ToastProps {
  id: string | number;
  title: string;
  description?: string;
  button?: {
    label: string;
    onClick: () => void;
  };
  type: "error" | "success" | "warning" | "info";
}
