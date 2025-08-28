import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import React from "react";
import { RingPercentage } from "./ring-percentage";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function InsightCard({
  user,
  userDescription,
  reason,
  match,
  actionType,
}: {
  user: string;
  userDescription: string;
  reason: string[];
  match: number;
  actionType: "contact" | "create-content" | "add-data";
}) {
  const actionTypeIcon: Record<
    "contact" | "create-content" | "add-data",
    IconName
  > = {
    contact: "HandWaveFillIcon",
    "create-content": "SparkleIcon",
    "add-data": "CylinderSplit1x2FillIcon",
  };

  const actionTypeText: Record<
    "contact" | "create-content" | "add-data",
    string
  > = {
    contact: "Reach out to",
    "create-content": "Create content on",
    "add-data": "Add data to",
  };

  const actionTypeColor: Record<
    "contact" | "create-content" | "add-data",
    string
  > = {
    contact: "text-blue-500",
    "create-content": "text-pink-600",
    "add-data": "text-pink-600",
  };

  return (
    <div
      className={cn(
        "rounded-xl w-full border  flex flex-col items-start relative  transition-all duration-200 translate-y-0 scale-100 ease-out group bg-neutral-50 border-neutral-100 hover:translate-y-[-1px] hover:shadow-xl hover:border-opacity-100 hover:scale-[1.02] cursor-pointer inset-shadow-[0_0_0_1px_rgba(255,255,255,1)]"
      )}
    >
      <div
        className={cn(
          "text-text-tertiary text-sm flex items-center gap-0.5 min-w-[130px] justify-start px-2.5 py-2 w-full rounded-t-xl"
        )}
      >
        <div className='flex items-center gap-2 w-full'>
          <div className='flex items-center gap-0.5'>
            {/* 
            <span className='whitespace-nowrap'>Insights from</span> */}
            <Icon
              name={actionTypeIcon[actionType]}
              className='size-5 min-w-5'
            />
            <span className='whitespace-nowrap'>
              {actionTypeText[actionType]}
            </span>
          </div>
          <div className='inline-flex items-center gap-1 w-full'>
            <Avatar className='size-5'>
              <AvatarFallback className='bg-dq-gray-900 text-text-primary-inverse text-[10px]'>
                CN
              </AvatarFallback>
            </Avatar>
            <div className='flex flex-col gap-0 min-w-0'>
              <div className='text-text-strong text-sm'>{user}</div>
            </div>
          </div>
        </div>
      </div>

      <div className='text-text-primary px-2.5 py-2.5 border-neutral-100 border border-px w-full rounded-[13px] bg-white shadow-lg flex items-center gap-1.5'>
        <Icon
          name='LightbulbFillIcon'
          className='size-4.5 text-neutral-400 min-w-4.5'
        />
        Rising engagement with your guidence on{" "}
        <span className='text-[#FF5C02]'>improving sleep</span> and optimizing
        daily routines.
      </div>
    </div>
  );
}
