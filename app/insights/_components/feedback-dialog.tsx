"use client";

import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startOnSecondPage?: boolean;
}

export function FeedbackDialog({
  open,
  onOpenChange,
  startOnSecondPage,
}: FeedbackDialogProps) {
  const [currentPage, setCurrentPage] = useState(0); // 0: initial, 1: rating, 2: textarea
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const firstPageRef = useRef<HTMLDivElement>(null);
  const ratingPageRef = useRef<HTMLDivElement>(null);
  const textPageRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number | "auto">(
    "auto"
  );

  // When dialog opens, decide which page to show based on prop
  useEffect(() => {
    if (open) {
      setCurrentPage(startOnSecondPage ? 2 : 0);
    }
  }, [open, startOnSecondPage]);

  // Update height when switching pages
  useEffect(() => {
    if (open) {
      let targetRef;
      switch (currentPage) {
        case 0:
          targetRef = firstPageRef;
          break;
        case 1:
          targetRef = ratingPageRef;
          break;
        case 2:
          targetRef = textPageRef;
          break;
      }
      if (targetRef?.current) {
        setContainerHeight(targetRef.current.scrollHeight);
      }
    }
  }, [currentPage, open]);

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after animation completes
    setTimeout(() => {
      setCurrentPage(0);
      setFeedback("");
      setRating(null);
    }, 200);
  };

  const handleFeedbackSubmit = () => {
    console.log("Feedback submitted:", { rating, feedback });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "fixed left-1/2 bottom-0 translate-x-[-50%] translate-y-[calc(100%-3rem)]",
          "max-w-[496px] rounded-2xl shadow-2xl h-fit p-0",
          "bg-white dark:bg-gray-900 border-gray-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "duration-300"
        )}
      >
        <motion.div
          className='relative'
          animate={{ height: containerHeight }}
          initial={false}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className='overflow-hidden relative px-5'>
            <motion.div
              className='flex gap-6'
              animate={{
                x: `calc(-${currentPage * 100}% - ${currentPage * 24}px)`,
              }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
                duration: 0.3,
              }}
            >
              {/* First Page */}
              <div
                ref={firstPageRef}
                className='w-full flex-shrink-0 flex flex-col justify-center items-center gap-6'
              >
                <DialogHeader className='gap-0'>
                  <DialogTitle className='text-lg font-medium text-center text-text-primary'>
                    <div className='leading-[1.2]'>
                      We noticed that you took{" "}
                      <div className='inline-flex items-center'>
                        <span className='text-orange-500'>0</span>
                        <span className='mx-0.5'>/ </span>
                        <span className='mr-1'>12</span>
                      </div>
                      actions we suggested.
                    </div>
                  </DialogTitle>
                  <DialogDescription className='text-text-primary text-lg text-center font-medium'>
                    Tell us why and we&apos;ll give you better recommendations.
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter className='flex-row gap-2 sm:gap-2 justify-center items-center flex'>
                  <Button variant='outline' onClick={handleClose} size='sm'>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(1)}
                    variant='primary'
                    size='sm'
                  >
                    Give Feedback
                  </Button>
                </DialogFooter>
              </div>

              {/* Rating Page */}
              <div
                ref={ratingPageRef}
                className='w-full flex-shrink-0 flex flex-col justify-center items-center gap-6'
              >
                <DialogHeader className='gap-0'>
                  <DialogTitle className='text-lg font-medium text-center text-text-primary'>
                    How helpful were our recommendations?
                  </DialogTitle>
                  <DialogDescription className='sr-only'>
                    Rate from 0 (not helpful) to 10 (very helpful)
                  </DialogDescription>
                </DialogHeader>

                <div className='flex flex-wrap justify-center gap-1 max-w-md'>
                  {[...Array(11)].map((_, i) => (
                    <Button
                      key={i}
                      variant={rating === i ? "primary" : "outline"}
                      size='sm'
                      onClick={() => setRating(i)}
                      className='w-9 h-9 p-0'
                    >
                      {i}
                    </Button>
                  ))}
                </div>

                <DialogFooter className='flex-row gap-2 sm:gap-2 justify-center items-center flex'>
                  <Button
                    variant='outline'
                    onClick={() => setCurrentPage(0)}
                    size='sm'
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(2)}
                    variant='primary'
                    size='sm'
                    disabled={rating === null}
                  >
                    Next
                  </Button>
                </DialogFooter>
              </div>

              {/* Text Feedback Page */}
              <div
                ref={textPageRef}
                className='w-full flex-shrink-0 pt-4.5 pb-5'
              >
                <DialogHeader className='gap-0 mb-1 px-1'>
                  <DialogTitle className='text-lg font-medium leading-1.2'>
                    How can we do better?
                  </DialogTitle>
                  <DialogDescription className='sr-only'>
                    Your detailed feedback helps us improve recommendations.
                  </DialogDescription>
                </DialogHeader>

                <div className='py-2 pb-4'>
                  <Textarea
                    placeholder='What would make our recommendations more helpful?'
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className='min-h-[88px] resize-none overflow-auto max-h-[88px]'
                  />
                </div>

                <DialogFooter className='flex-row gap-2 sm:gap-2'>
                  <Button
                    variant='outline'
                    onClick={() => setCurrentPage(1)}
                    className='flex-1'
                    size='sm'
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleFeedbackSubmit}
                    disabled={!feedback.trim()}
                    className='flex-1'
                    variant='primary'
                    size='sm'
                  >
                    Submit
                  </Button>
                </DialogFooter>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
