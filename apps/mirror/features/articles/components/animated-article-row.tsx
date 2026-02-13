"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@feel-good/utils/cn";
import { articleRowVariants } from "../utils/article-list.config";

type AnimatedArticleRowProps = {
  children: ReactNode;
  shouldAnimate: boolean;
  index: number;
  className?: string;
  "data-state"?: string;
};

const tableRowClassName =
  "hover:bg-muted/50 data-[state=selected]:bg-muted dark:data-[state=selected]:bg-muted/50 border-b transition-colors";

export function AnimatedArticleRow({
  children,
  shouldAnimate,
  index,
  className,
  "data-state": dataState,
}: AnimatedArticleRowProps) {
  if (shouldAnimate) {
    return (
      <motion.tr
        data-slot="table-row"
        data-state={dataState}
        className={cn(tableRowClassName, className)}
        variants={articleRowVariants}
        initial="hidden"
        animate="visible"
        custom={index}
      >
        {children}
      </motion.tr>
    );
  }

  return (
    <tr
      data-slot="table-row"
      data-state={dataState}
      className={cn(tableRowClassName, className)}
    >
      {children}
    </tr>
  );
}
