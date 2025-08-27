import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import React from "react";
import { RingPercentage } from "./ring-percentage";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";

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

  return (
    <div className='rounded-xl w-full border px-3 py-3 flex flex-col items-start relative  transition-all duration-200 translate-y-0  scale-100 ease-out group bg-white/30 border-white/30 inset-shadow-none hover:bg-base hover:translate-y-[-1px] shadow-xs hover:shadow-[0_8px_8px_-4px_rgba(255,255,255,0.9),_0_12px_12px_-6px_rgba(0,0,0,0.3)]  hover:border-opacity-100 hover:scale-[1.02] cursor-pointer'>
      <div className='flex w-full gap-4'>
        <div className='text-text-tertiary text-sm flex items-center gap-0.5 min-w-[130px] justify-start'>
          <Icon
            name={actionTypeIcon[actionType]}
            className='size-5 text-icon-light min-w-5'
          />
          <span className='whitespace-nowrap'>
            {actionTypeText[actionType]}
          </span>
        </div>
        <div className='inline-flex items-center gap-2 py-2 px-2.5 border border-dq-gray-150 rounded-lg w-full'>
          {actionType === "contact" && (
            <div className='flex items-center gap-4 w-full'>
              <div className='flex items-center gap-2 w-full'>
                <Avatar className='size-8'>
                  <AvatarFallback className='bg-dq-gray-900 text-text-primary-inverse text-xs'>
                    CN
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-col gap-0 min-w-0'>
                  <div className='text-text-strong text-sm'>{user}</div>
                  <div className='text-text-muted text-sm leading-[1.2] truncate clamp-1'>
                    {userDescription}
                  </div>
                </div>
              </div>

              <div className='flex items-center justify-center gap-1'>
                <div className='text-text-muted text-xs whitespace-nowrap mr-1'>
                  Match Score
                </div>
                <RingPercentage value={match} size={32} />
              </div>
            </div>
          )}

          {actionType === "create-content" && (
            <div className='flex items-center gap-4 w-full'>
              <div className='flex flex-col gap-0 min-w-0 w-full'>
                <div className='text-text-strong w-full pl-0.5'>
                  How to set pricing of an AI product.
                </div>
                <div className='text-text-muted text-sm whitespace-nowrap'>
                  #AI, #Startup
                </div>
              </div>
              <div className='flex items-center justify-center gap-1'>
                <div className='text-text-muted text-xs whitespace-nowrap mr-1'>
                  Demand Signal
                </div>
                <RingPercentage value={match} size={32} />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className='w-full h-px bg-dq-gray-150 my-3.5' />
      <div className='flex flex-col w-full pb-0.5'>
        <ul className='list-disc pl-4'>
          {reason.map((item, index) => (
            <li
              className='text-text-tertiary text-sm leading-[140%]'
              key={index}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
