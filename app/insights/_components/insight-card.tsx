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
        "rounded-xl w-full flex flex-col items-start relative  transition-all duration-200 translate-y-0 scale-100 ease-out group hover:translate-y-[-1px] hover:shadow-lg hover:border-opacity-100 hover:scale-[1.02] cursor-pointer inset-shadow-[0_0_0_1px_rgba(255,255,255,1)] p-1 bg-white"
      )}
    >
      <div
        className={cn(
          "text-text-tertiary text-sm flex items-center gap-0.5 min-w-[130px] justify-start px-2.5 py-0.5 w-full pb-1.5"
        )}
      >
        <div className='flex items-center gap-2 w-full'>
          <div className={cn("flex items-center gap-0.5")}>
            <Icon
              name={actionTypeIcon[actionType]}
              className={cn(
                "size-5.5 min-w-5.5 mr-0.5 rounded-full p-0.5",
                actionType === "contact" && "text-blue-500 bg-blue-100 ",
                actionType === "create-content" && "text-pink-600 bg-pink-100",
                actionType === "add-data" && "text-pink-500 bg-pink-100"
              )}
            />
            <span className='whitespace-nowrap'>
              {actionTypeText[actionType]}
            </span>
          </div>

          {actionType === "contact" && (
            <div className='flex items-center gap-1 px-1 rounded-md border border-neutral-100 w-fit pr-2 h-8'>
              <Avatar className='size-5'>
                <AvatarFallback className='bg-dq-gray-900 text-text-primary-inverse text-[10px]'>
                  CN
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col gap-0 min-w-0'>
                <div className='text-text-strong text-sm'>{user}</div>
              </div>
              <div className='w-px bg-neutral-100 self-stretch mx-1' />
              <RingPercentage value={match} />
            </div>
          )}

          {actionType === "create-content" && (
            <div className='inline-flex items-center gap-0.5 p-1 rounded-md border border-neutral-100 w-fit pr-2'>
              <Icon name='SparkleIcon' className='size-5' />
              Healthy diet
            </div>
          )}
          {actionType === "add-data" && (
            <div className='inline-flex items-center gap-1 p-1 rounded-md border border-neutral-100 w-fit pr-1.5'>
              <Icon name='CylinderSplit1x2FillIcon' className='size-5' />
            </div>
          )}
        </div>
      </div>

      <div className='text-text-primary px-2.5 py-3 border-neutral-100 border border-px w-full rounded-[12px] bg-white flex items-start gap-1 '>
        <Icon
          name='LightbulbFillIcon'
          className='size-4.5 text-icon-light min-w-4.5 mt-[1px]'
        />
        <p className='text-text-strong text-md leading-[1.2] pl-0.5'>
          Rising engagement with your guidence on{" "}
          <span className='text-[#FF5C02]'>improving sleep</span>
          and optimizing daily routines. Rising engagement with your guidence on{" "}
          <span className='text-[#FF5C02]'>improving sleep</span> and optimizing
          daily routines.
        </p>
      </div>
    </div>
  );
}
