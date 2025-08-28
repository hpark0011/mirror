"use client";

import React, { useState } from "react";
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

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [showTextarea, setShowTextarea] = useState(false);
  const [feedback, setFeedback] = useState("");

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
          "mb-8 max-w-[496px] rounded-2xl shadow-2xl h-fit px-5",
          "bg-white dark:bg-gray-900 border-gray-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "duration-300"
        )}
      >
        {!showTextarea ? (
          <>
            <DialogHeader>
              <DialogTitle className='text-xl font-medium'>
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
              <DialogDescription className='text-text-tertiary text-md'>
                Tell us why and we&apos;ll give you better recommendations.
              </DialogDescription>
            </DialogHeader>

            <div className='flex flex-col gap-4 py-4'>
              <div className='flex items-center justify-center gap-0 border w-fit rounded-lg bg-neutral-100 mx-auto p-0.5'>
                <Button
                  variant='outline'
                  size='sm'
                  className='text-text-primary bg-transparent border-none hover:bg-white'
                  onClick={() => {
                    console.log("Feedback: Yes");
                    handleClose();
                  }}
                >
                  Yes
                </Button>
                <div className='w-px h-4 bg-dq-gray-200' />
                <Button
                  variant='outline'
                  size='sm'
                  className='text-text-primary bg-transparent border-none hover:bg-white'
                  onClick={() => {
                    console.log("Feedback: No");
                    handleClose();
                  }}
                >
                  No
                </Button>
                <div className='w-px h-4 bg-dq-gray-200' />
                <Button
                  variant='outline'
                  size='sm'
                  className='text-text-primary bg-transparent border-none hover:bg-white'
                  onClick={() => setShowTextarea(true)}
                >
                  Provide detailed feedback
                </Button>
              </div>
            </div>

            <DialogFooter className='flex-row gap-2 sm:gap-2'>
              <Button
                variant='outline'
                onClick={handleClose}
                className='flex-1'
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowTextarea(true)}
                className='flex-1 bg-black text-white hover:bg-gray-800'
              >
                Give Feedback
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className='text-xl font-medium'>
                Tell us more
              </DialogTitle>
              <DialogDescription className='text-text-tertiary text-md'>
                Your detailed feedback helps us improve recommendations
              </DialogDescription>
            </DialogHeader>

            <div className='py-4'>
              <Textarea
                placeholder='What would make our recommendations more helpful?'
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className='min-h-[120px] resize-none'
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
