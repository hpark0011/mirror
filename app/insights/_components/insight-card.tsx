"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  INSIGHT_VARIANTS,
  type InsightActionType,
} from "@/config/insight-variants";
import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";
import { InsightHeaderBadgeWrapper } from "./insight-components";
import { RingPercentage } from "./ring-percentage";

export function InsightCard({
  user,
  match,
  actionType,
  segments,
  references,
  index = 0,
}: {
  user: string;
  match: number;
  actionType: InsightActionType;
  segments?: ReadonlyArray<{ text: string; highlight?: boolean }>;
  references?: ReadonlyArray<{
    chatNumber: number;
    messageNumber: number;
    initials?: string;
  }>;
  index?: number;
}) {
  const variant = INSIGHT_VARIANTS[actionType];
  const cardVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 30,
      scale: 0.98,
    },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: i * 0.05,
        type: "spring" as const,
        damping: 20,
        stiffness: 300,
      },
    }),
  };

  return (
    <>
      <motion.div
        variants={cardVariants}
        initial='hidden'
        animate='visible'
        custom={index}
        className={cn(
          "rounded-[16px] w-full flex flex-col items-start relative  transition-all duration-200 translate-y-0 scale-100 ease-out group hover:translate-y-[-1px] hover:shadow-lg hover:border-opacity-100 hover:scale-[1.02] cursor-pointer inset-shadow-[0_0_0_1px_rgba(255,255,255,1)] p-1.5 bg-white"
        )}
      >
        <div className='flex items-center justify-between w-fit absolute top-1.5 right-1.5 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto transform-gpu  opacity-0 transition-all duration-200 ease-out translate-y-[-8px] gap-2.5'>
          <div className='flex items-center gap-2'>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className='rounded-full  text-icon-extra-light hover:text-icon-dark'>
                  <Icon name='HandsThumbsupFillIcon' className='size-4.5' />
                </button>
              </TooltipTrigger>
              <TooltipContent>Helpful</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className='rounded-full  text-icon-extra-light hover:text-icon-dark'>
                  <Icon name='HandsThumbsdownFillIcon' className='size-4.5' />
                </button>
              </TooltipTrigger>
              <TooltipContent>Not helpful</TooltipContent>
            </Tooltip>
          </div>
          <Button
            variant='outline'
            className='gap-0.5 h-[26px] pl-1 has-[>svg]:pl-1.5  transition-all duration-200 ease-out  bg-transparent border-neutral-200'
            size='sm'
            onClick={() => {}}
          >
            <Icon name='SparkleIcon' className='size-4 text-orange-500' />
            <span className='text-xs'>Take Action</span>
          </Button>
        </div>
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
                  <div className='text-text-strong'>{user}</div>
                </div>
                <div className='w-px bg-extra-light self-stretch mx-1' />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <RingPercentage value={match} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Match Score</TooltipContent>
                </Tooltip>
              </InsightHeaderBadgeWrapper>
            )}
            {actionType === "create-content" && (
              <InsightHeaderBadgeWrapper className='pl-2'>
                # Healthy diet
                <div className='w-px bg-extra-light self-stretch mx-1' />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <RingPercentage value={match} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Demand Signal</TooltipContent>
                </Tooltip>
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

        <div className='text-text-primary px-3 py-3 border-neutral-100 border border-px w-full rounded-[12px] bg-white flex items-start gap-1 '>
          <div>
            <p className='text-text-strong text-md leading-[1.3] pl-0.5'>
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
            {references && references.length > 0 && (
              <div className='flex items-center mt-2 -ml-0.5 gap-1'>
                {references.map((ref, i) => (
                  <div
                    key={`${ref.chatNumber}-${ref.messageNumber}-${i}`}
                    className='px-2 pl-1.5 gap-1 text-[11px] flex items-center bg-neutral-100 rounded-md h-[24px] hover:bg-neutral-200'
                  >
                    <Avatar className='size-[14px]'>
                      <AvatarFallback className='bg-dq-gray-900 text-text-primary-inverse text-[8px]'>
                        {ref.initials ?? "HP"}
                      </AvatarFallback>
                    </Avatar>
                    Chat {ref.chatNumber}{" "}
                    <span className='text-text-muted px-0.5'>/</span> Message{" "}
                    {ref.messageNumber}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
