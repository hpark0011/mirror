"use client";

import React, { useEffect, useState } from "react";
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
import { AnimatePresence, motion } from "framer-motion";

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
  const [showTextarea, setShowTextarea] = useState(false);
  const [feedback, setFeedback] = useState("");

  // When dialog opens, decide which page to show based on prop
  useEffect(() => {
    if (open) {
      setShowTextarea(!!startOnSecondPage);
    }
  }, [open, startOnSecondPage]);

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after animation completes
    setTimeout(() => {
      setShowTextarea(false);
      setFeedback("");
    }, 200);
  };

  const handleFeedbackSubmit = () => {
    console.log("Feedback submitted:", feedback);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "fixed left-1/2 bottom-0 translate-x-[-50%] translate-y-0",
          "max-w-[496px] rounded-2xl shadow-2xl h-fit p-0",
          "bg-white dark:bg-gray-900 border-gray-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "duration-300"
        )}
      >
        <div className='overflow-hidden relative px-5'>
          <motion.div
            className='flex gap-6'
            animate={{ x: showTextarea ? "calc(-100% - 24px)" : "0%" }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
              duration: 0.3,
            }}
          >
            {/* First Page */}
            <div className='w-full flex-shrink-0 flex flex-col justify-center items-center gap-4'>
              <DialogHeader>
                <DialogTitle className='text-xl font-medium text-center'>
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
                <DialogDescription className='text-text-tertiary text-md text-center'>
                  Tell us why and we&apos;ll give you better recommendations.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className='flex-row gap-2 sm:gap-2 justify-center items-center flex'>
                <Button variant='outline' onClick={handleClose} size='sm'>
                  Cancel
                </Button>
                <Button
                  onClick={() => setShowTextarea(true)}
                  variant='primary'
                  size='sm'
                >
                  Give Feedback
                </Button>
              </DialogFooter>
            </div>

            {/* Second Page */}
            <div className='w-full flex-shrink-0 py-4'>
              <DialogHeader className='gap-0 mb-0 px-1'>
                <DialogTitle className='text-xl font-medium'>
                  Tell us more
                </DialogTitle>
                <DialogDescription className='text-text-tertiary text-md'>
                  Your detailed feedback helps us improve recommendations.
                </DialogDescription>
              </DialogHeader>

              <div className='py-2 pb-4'>
                <Textarea
                  placeholder='What would make our recommendations more helpful?'
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className='min-h-[80px] resize-none'
                />
              </div>

              <DialogFooter className='flex-row gap-2 sm:gap-2'>
                <Button
                  variant='outline'
                  onClick={() => setShowTextarea(false)}
                  className='flex-1'
                >
                  Back
                </Button>
                <Button
                  onClick={handleFeedbackSubmit}
                  disabled={!feedback.trim()}
                  className='flex-1 bg-black text-white hover:bg-gray-800 disabled:opacity-50'
                >
                  Submit
                </Button>
              </DialogFooter>
            </div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
