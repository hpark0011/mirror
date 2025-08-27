import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import React from "react";
import { InsightCard } from "./_components/insight-card";

const insights = [
  {
    user: "John Doe",
    userDescription: "Writer - currently writing about healthy diet",
    reason: [
      "Influential tech founder with 50K+ followers. Mentioned considering a public testimonial about your product.",
      "Technical leader evaluating AI for fraud detection. Your expertise in financial AI makes this a perfect match.",
    ],
    match: 90,
    actionType: "contact",
  },
  {
    user: "Sam Jung",
    userDescription: "CTO at FinanceFlow - Currently evaluating AI solutions",
    reason: [
      "Technical leader evaluating AI for fraud detection. Your expertise in financial AI makes this a perfect match.",
    ],
    match: 80,
    actionType: "contact",
  },
  {
    user: "Sam Jung",
    userDescription: "CTO at FinanceFlow - Currently evaluating AI solutions",
    reason: [
      "Technical leader evaluating AI for fraud detection. Your expertise in financial AI makes this a perfect match.",
    ],
    match: 80,
    actionType: "contact",
  },
  {
    user: "David Thompson",
    userDescription: "AI Researcher at University",
    reason: [
      "47 users asked about integrating AI ethics into corporate training. This could be your next viral blog post or video series.",
    ],
    match: 75,
    actionType: "create-content",
  },
  {
    user: "Sam Jung",
    userDescription: "CTO at FinanceFlow - Currently evaluating AI solutions",
    reason: [
      "47 users asked about integrating AI ethics into corporate training. This could be your next viral blog post or video series.",
    ],
    match: 74,
    actionType: "create-content",
  },
];

export default function InsightsPage() {
  return (
    <div className='flex flex-col max-w-3xl mx-auto w-full gap-4 pb-[80px]'>
      <h1 className='text-2xl font-medium w-full flex items-center justify-center mb-8'>
        Good afternoon, Han
      </h1>

      <TrendGroupWrapper>
        <div className='text-text-muted text-sm w-full flex items-center gap-1'>
          <Icon
            name='TextBubbleFillIcon'
            className='size-5 text-icon-light -ml-1'
          />{" "}
          Summary of your clone
        </div>
        <div className='flex flex-col gap-6 w-full'>
          <div className='space-y-3'>
            <div className='text-text-strong text-lg w-full'>
              Your clone is getting more popular!
            </div>
            <div className='grid grid-cols-4 gap-2 w-[calc(100%+16px)] -ml-2'>
              <InsightsCardWrapper orientation='vertical'>
                <InsightsCardLabel>Chats Exchanged</InsightsCardLabel>
                <InsightsCardValueWrapper>
                  <InsightsCardValue>232</InsightsCardValue>
                  <GrowthRate isPositive>43%</GrowthRate>
                </InsightsCardValueWrapper>
              </InsightsCardWrapper>
              <InsightsCardWrapper orientation='vertical'>
                <InsightsCardLabel>Users Engaged</InsightsCardLabel>
                <InsightsCardValueWrapper>
                  <InsightsCardValue>24</InsightsCardValue>
                  <GrowthRate isPositive>10%</GrowthRate>
                </InsightsCardValueWrapper>
              </InsightsCardWrapper>
              <InsightsCardWrapper orientation='vertical'>
                <InsightsCardLabel>Actions Created</InsightsCardLabel>
                <InsightsCardValueWrapper>
                  <InsightsCardValue>8</InsightsCardValue>
                  <GrowthRate isPositive={false}>10%</GrowthRate>
                </InsightsCardValueWrapper>
              </InsightsCardWrapper>
              <InsightsCardWrapper orientation='vertical'>
                <InsightsCardLabel>Average Match</InsightsCardLabel>
                <InsightsCardValueWrapper>
                  <InsightsCardValue>71%</InsightsCardValue>
                  <GrowthRate isPositive>4%</GrowthRate>
                </InsightsCardValueWrapper>
              </InsightsCardWrapper>
            </div>
          </div>

          <div className='space-y-3'>
            <div className='text-text-strong text-lg leading-[140%]'>
              <span className='flex items-center gap-1'>
                Your audience is{" "}
                <Icon
                  name='LineUpTrendIcon'
                  className='size-4.5 text-green-600'
                />{" "}
                engaing more with health related topics.{" "}
              </span>
              <span className='flex items-center gap-1'>
                Career guidance and motivation are on the{" "}
                <Icon
                  name='LineDownTrendIcon'
                  className='size-4.5 text-red-600'
                />{" "}
                decline.
              </span>
            </div>
            <div className='flex w-[calc(100%+16px)] -ml-2'>
              <InsightsCardWrapper isHoverable={false} className='pt-2.5'>
                <div className='flex items-center gap-2 w-full'>
                  <div className='flex flex-col gap-1 w-full'>
                    <div className='text-sm text-text-muted mb-2 flex items-center gap-1 flex-row'>
                      <Icon name='LineUpTrendIcon' className='size-4.5' />
                      Trending up
                    </div>
                    <TrendItem>
                      # Healthy diet
                      <GrowthRate isPositive>74%</GrowthRate>
                    </TrendItem>
                    <TrendItem>
                      # Mindfulness and meditation
                      <GrowthRate isPositive>42%</GrowthRate>
                    </TrendItem>
                    <TrendItem>
                      # Creating a routine
                      <GrowthRate isPositive>39%</GrowthRate>
                    </TrendItem>
                    <TrendItem>
                      # Creating a routine
                      <GrowthRate isPositive>22%</GrowthRate>
                    </TrendItem>
                  </div>
                  <div className='w-px min-w-[1px] bg-extra-light self-stretch shrink-0 mx-2' />
                  <div className='flex flex-col gap-1 w-full self-stretch'>
                    <div className='text-sm text-text-muted mb-2 flex items-center gap-1 flex-row'>
                      <Icon name='LineDownTrendIcon' className='size-4.5' />
                      Trending down
                    </div>
                    <TrendItem>
                      # Career guidance
                      <GrowthRate isPositive={false}>56%</GrowthRate>
                    </TrendItem>
                    <TrendItem>
                      # Motivation
                      <GrowthRate isPositive={false}>47%</GrowthRate>
                    </TrendItem>
                    <TrendItem>
                      # Motivation
                      <GrowthRate isPositive={false}>10%</GrowthRate>
                    </TrendItem>
                  </div>
                </div>
              </InsightsCardWrapper>
            </div>
          </div>
        </div>
      </TrendGroupWrapper>

      <TrendGroupWrapper>
        <div className='text-text-muted text-sm w-full flex items-center gap-1'>
          <Icon name='SparkleIcon' className='size-5 text-icon-light -ml-1' />{" "}
          Top actions you can take
        </div>
        <div className='space-y-3'>
          <div className='text-text-strong text-lg w-full'>
            Take these actions to get more opportunities.
          </div>
          <div className='flex flex-col gap-6 w-full'>
            <div className='flex flex-col gap-2 w-[calc(100%+16px)] -ml-2'>
              {insights.map((insight, index) => (
                <InsightCard
                  key={index}
                  user={insight.user ?? ""}
                  userDescription={insight.userDescription ?? ""}
                  reason={insight.reason ?? [""]}
                  match={insight.match ?? 0}
                  actionType={
                    insight.actionType as
                      | "contact"
                      | "create-content"
                      | "add-data"
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </TrendGroupWrapper>
    </div>
  );
}

export function TrendGroupWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className='py-3.5 pt-3 px-5 border border-light rounded-3xl gap-6 flex flex-col w-full'>
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
        "rounded-xl w-full border p-3 py-2.5 flex flex-col justify-between items-start relative  transition-all duration-200 translate-y-0  scale-100 ease-out group bg-white/30 border-white/30  gap-0 inset-shadow-none shadow-xs hover:bg-base hover:shadow-[0_12px_12px_-6px_rgba(255,255,255,0.9),_0_14px_14px_-6px_rgba(0,0,0,0.3) hover:translate-y-[-1px] hover:border-opacity-100 hover:scale-[1.02] cursor-pointer gap-2 justify-start",
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
        "rounded-xl w-full border p-3 py-2.5 flex flex-row justify-between items-center relative  transition-all duration-200 translate-y-0  scale-100 ease-out group bg-white/30 border-white/30  gap-0 inset-shadow-none shadow-xs",
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
