"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { RingPercentage } from "./ring-percentage";
import { InsightHeaderBadgeWrapper } from "./insight-components";
import {
  INSIGHT_VARIANTS,
  type InsightActionType,
} from "@/config/insight-variants";
import { Button } from "@/components/ui/button";

export function InsightCard({
  user,
  match,
  actionType,
  segments,
}: {
  user: string;
  match: number;
  actionType: InsightActionType;
  segments?: ReadonlyArray<{ text: string; highlight?: boolean }>;
}) {
  const variant = INSIGHT_VARIANTS[actionType];

  return (
    <div
      className={cn(
        "rounded-xl w-full flex flex-col items-start relative  transition-all duration-200 translate-y-0 scale-100 ease-out group hover:translate-y-[-1px] hover:shadow-lg hover:border-opacity-100 hover:scale-[1.02] cursor-pointer inset-shadow-[0_0_0_1px_rgba(255,255,255,1)] p-1 bg-white"
      )}
    >
      <Button
        variant='outline'
        className='absolute top-1.5 right-1.5 gap-0.5 h-[26px] pl-1 has-[>svg]:pl-1.5 opacity-0 -translate-y-1 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto transform-gpu bg-transparent border-neutral-200'
        size='sm'
        onClick={() => {}}
      >
        <Icon name='SparkleIcon' className='size-4 text-orange-500' />
        <span className='text-xs'>Take Action</span>
      </Button>
      <div
        className={cn(
          "text-text-tertiary text-sm flex items-center gap-0.5 min-w-[130px] justify-start px-2.5 py-0.5 w-full pb-1.5"
        )}
      >
        <div className='flex items-center gap-2 w-full'>
          <div className={cn("flex items-center gap-0.5")}>
            <Icon
              name={variant.icon}
              className={cn(
                "size-5.5 min-w-5.5 mr-1 rounded-full p-0.5",
                variant.iconColorClasses
              )}
            />
            <span className='whitespace-nowrap'>{variant.headerText}</span>
          </div>
          {actionType === "contact" && (
            <InsightHeaderBadgeWrapper>
              <Avatar className='size-[18px]'>
                <AvatarFallback className='bg-dq-gray-900 text-text-primary-inverse text-[9px]'>
                  CN
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col gap-0 min-w-0'>
                <div className='text-text-strong text-[13px]'>{user}</div>
              </div>
              <div className='w-px bg-extra-light self-stretch mx-1' />
              <RingPercentage value={match} />
            </InsightHeaderBadgeWrapper>
          )}
          {actionType === "create-content" && (
            <InsightHeaderBadgeWrapper className='pl-2'>
              # Healthy diet
              <div className='w-px bg-extra-light self-stretch mx-1' />
              <RingPercentage value={match} />
            </InsightHeaderBadgeWrapper>
          )}
          {actionType === "add-data" && (
            <>
              <InsightHeaderBadgeWrapper className='gap-1 pl-2'>
                <div>Use simple words, avoid jargon</div>
              </InsightHeaderBadgeWrapper>
              to your{" "}
              <InsightHeaderBadgeWrapper className='gap-1 pl-2'>
                Response Style
              </InsightHeaderBadgeWrapper>
            </>
          )}
        </div>
      </div>

      <div className='text-text-primary px-2.5 py-3 border-neutral-100 border border-px w-full rounded-[12px] bg-white flex items-start gap-1 '>
        <Icon
          name='LightbulbFillIcon'
          className='size-4.5 text-icon-light min-w-4.5 mt-[1px]'
        />
        <div>
          <p className='text-text-strong text-md leading-[1.2] pl-0.5'>
            {segments?.map((segment, index) =>
              segment.highlight ? (
                <span key={index} className='text-[#FF5C02] font-medium'>
                  {segment.text}
                </span>
              ) : (
                <span key={index}>{segment.text}</span>
              )
            )}
          </p>
          <div className='flex items-center mt-2 -ml-0.5 gap-1'>
            <div className='px-2 pl-1.5 gap-1 text-[11px] flex items-center bg-neutral-100 rounded-md h-[24px]'>
              <Avatar className='size-[14px]'>
                <AvatarFallback className='bg-dq-gray-900 text-text-primary-inverse text-[8px]'>
                  HP
                </AvatarFallback>
              </Avatar>
              Chat with hello
            </div>
            <div className='px-2 pl-1.5 gap-1 text-[11px] flex items-center bg-neutral-100 rounded-md h-[24px]'>
              <Avatar className='size-[14px]'>
                <AvatarFallback className='bg-dq-gray-900 text-text-primary-inverse text-[8px]'>
                  HP
                </AvatarFallback>
              </Avatar>
              Chat with hello
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
