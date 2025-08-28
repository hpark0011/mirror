"use client";

import { Icon } from "@/components/ui/icon";
import React, { useEffect, useState, useRef } from "react";
import { InsightCard } from "./_components/insight-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, type Variants } from "framer-motion";
import {
  TrendGroupWrapper,
  InsightsCardWrapper,
  InsightsCardLabel,
  InsightsCardValueWrapper,
  InsightsCardValue,
  GrowthRate,
  TrendBodyWrapper,
} from "./_components/insight-components";
import { insights } from "./data";
import { FeedbackDialog } from "./_components/feedback-dialog";

const groupVariants: Variants = {
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

export default function InsightsPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hasShownDrawer, setHasShownDrawer] = useState(false);
  const [startOnSecondPage, setStartOnSecondPage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bottomElement = bottomRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasShownDrawer) {
          setIsDrawerOpen(true);
          setHasShownDrawer(true);
        }
      },
      {
        threshold: 0.1,
      }
    );

    if (bottomElement) {
      observer.observe(bottomElement);
    }

    return () => {
      if (bottomElement) {
        observer.unobserve(bottomElement);
      }
    };
  }, [hasShownDrawer]);

  return (
    <div className='flex flex-col max-w-2xl mx-auto w-full gap-6 pb-[80px] px-4 justify-center items-center'>
      <h1 className='text-2xl font-medium w-full flex items-center justify-center mb-4'>
        Good afternoon, Han
      </h1>

      <Tabs
        defaultValue='summary'
        className='w-full flex flex-col justify-center items-center gap-6'
      >
        <TabsList className='w-fit flex justify-center gap-1'>
          <TabsTrigger value='summary'>Summary</TabsTrigger>
          <div className='w-px h-4 bg-dq-gray-200' />
          <TabsTrigger value='actions'>All Actions</TabsTrigger>
          <div className='w-px h-4 bg-dq-gray-200' />
          <TabsTrigger value='chats'>All Insights</TabsTrigger>
        </TabsList>

        <TabsContent
          value='summary'
          className='w-full flex flex-col justify-center items-center gap-6'
        >
          <motion.div
            variants={groupVariants}
            initial='hidden'
            animate='visible'
            custom={0}
            className='w-full'
          >
            <TrendGroupWrapper>
              <div className='text-text-muted text-sm w-full flex items-center gap-1 bg-white py-2 px-4'>
                <Icon
                  name='TextBubbleFillIcon'
                  className='size-5 text-icon-light -ml-1'
                />{" "}
                Summary of your clone
              </div>
              <TrendBodyWrapper>
                <div className='space-y-3'>
                  <div className='text-text-strong w-full py-1'>
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
              </TrendBodyWrapper>
            </TrendGroupWrapper>
          </motion.div>

          <motion.div
            variants={groupVariants}
            initial='hidden'
            animate='visible'
            custom={1}
          >
            <TrendGroupWrapper>
              <div className='text-text-muted text-sm w-full flex items-center gap-1 bg-white py-2 px-4 '>
                <Icon
                  name='SparkleIcon'
                  className='size-5 text-icon-light -ml-1'
                />{" "}
                Top actions you can take
              </div>
              <TrendBodyWrapper>
                <div className='space-y-3'>
                  <div className='text-text-strong text-md w-full py-1'>
                    Take these actions to get more opportunities.
                  </div>
                  <div className='flex flex-col gap-6 w-full'>
                    <div className='flex flex-col gap-2 w-[calc(100%+16px)] -ml-2'>
                      {insights.map((insight, index) => (
                        <InsightCard
                          key={index}
                          user={insight.user ?? ""}
                          match={insight.match ?? 0}
                          actionType={
                            insight.actionType as
                              | "contact"
                              | "create-content"
                              | "add-data"
                          }
                          segments={insight.segments}
                          references={insight.references}
                          index={index}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className='text-center flex flex-col justify-center w-full gap-2.5 items-center mb-10 mt-4'>
                  <div className='text-text-tertiary text-sm'>
                    Is this action recommendation helpful?
                  </div>
                  <div className='flex items-center justify-center gap-0 border w-fit rounded-lg bg-neutral-100 p-0.5fe'>
                    <Button
                      variant='outline'
                      size='sm'
                      className='text-text-primary bg-transparent border-none hover:bg-white'
                    >
                      Yes
                    </Button>
                    <div className='w-px h-4 bg-dq-gray-200' />
                    <Button
                      variant='outline'
                      size='sm'
                      className='text-text-primary bg-transparent border-none hover:bg-white'
                    >
                      No
                    </Button>
                    <div className='w-px h-4 bg-dq-gray-200' />
                    <Button
                      variant='outline'
                      size='sm'
                      className='text-text-primary bg-transparent border-none hover:bg-white'
                      onClick={() => {
                        setStartOnSecondPage(true);
                        setIsDrawerOpen(true);
                      }}
                    >
                      Provide detail feedback
                    </Button>
                  </div>
                </div>
              </TrendBodyWrapper>
            </TrendGroupWrapper>
          </motion.div>
        </TabsContent>
        <TabsContent
          value='actions'
          className='w-full flex flex-col justify-center items-center gap-4'
        >
          <div className='flex flex-col justify-center items-center'>
            <div className='text-text-strong text-[15px] text-center w-full'>
              All actions
            </div>
            <div className='text-blue-500 text-[15px] w-full text-center mb-2'>
              Sort and filters ui comes here
            </div>
          </div>
          <div className='flex flex-col gap-6 w-full'>
            <div className='flex flex-col gap-2 w-[calc(100%+16px)] -ml-2'>
              {insights.map((insight, index) => (
                <InsightCard
                  key={index}
                  user={insight.user ?? ""}
                  match={insight.match ?? 0}
                  actionType={
                    insight.actionType as
                      | "contact"
                      | "create-content"
                      | "add-data"
                  }
                  segments={insight.segments}
                  references={insight.references}
                  index={index}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value='chats'
          className='w-full flex flex-col justify-center items-center gap-4'
        >
          <div className='flex flex-col justify-center items-center'>
            <div className='text-text-strong text-[15px] text-center w-full'>
              All Insights
            </div>
            <div className='text-blue-500 text-[15px] w-full text-center mb-2'>
              Sort and filters ui comes here
            </div>
          </div>
          <div className='flex flex-col gap-6 w-full'>
            <div className='flex flex-col gap-2 w-[calc(100%+16px)] -ml-2'>
              {insights.map((insight, index) => (
                <InsightCard
                  key={index}
                  user={insight.user ?? ""}
                  match={insight.match ?? 0}
                  actionType={
                    insight.actionType as
                      | "contact"
                      | "create-content"
                      | "add-data"
                  }
                  segments={insight.segments}
                  references={insight.references}
                  index={index}
                />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <div ref={bottomRef} className='h-1' />
      <FeedbackDialog
        open={isDrawerOpen}
        onOpenChange={(open) => {
          setIsDrawerOpen(open);
          if (!open) {
            setStartOnSecondPage(false);
          }
        }}
        startOnSecondPage={startOnSecondPage}
      />
    </div>
  );
}
