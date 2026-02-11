import { cn } from "../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "relative py-2 px-3 bg-[rgba(255,255,255,0.4)] dark:bg-[rgba(255,255,255,0.05)] border-[1px] border-white/5 flex overflow-hidden cursor-pointer group transition-all duration-300 ease-in-out active:scale-[0.95] active:transition-transform active:duration-150 dark:border-[rgba(255,255,255,0.02)] backdrop-blur-xl text-center justify-center font-[480]",
  {
    variants: {
      size: {
        sm:
          "py-1 px-2.5 text-[13px] rounded-[10px] shadow-shiny-md hover:shadow-shiny-md-hover",
        md:
          "py-1 px-3 text-sm rounded-[10px] shadow-shiny-md hover:shadow-shiny-md-hover",
        lg:
          "py-1 px-3.5 text-sm rounded-[12px] shadow-shiny-lg hover:shadow-shiny-lg-hover",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const SHADOW_RADIUS = "rounded-[6px]";

const shadowVariants = cva(
  "absolute inset-0 inset-shadow-shiny blur-[3px] m-0.5 mt-2.5 group-hover:mt-0.5 group-hover:inset-shadow-shiny-hover group-hover:blur-[2px] transition-all duration-300 ease-in-out dark:bg-gradient-to-b dark:from-white/0 dark:to-white/10",
  {
    variants: {
      size: {
        sm: SHADOW_RADIUS,
        md: SHADOW_RADIUS,
        lg: "rounded-[8px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export interface ShinyButtonProps extends VariantProps<typeof buttonVariants> {
  type?: "button" | "submit" | "reset";
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  shadowClassName?: string;
}

export function ShinyButton({
  type = "button",
  children,
  onClick,
  className,
  shadowClassName,
  size,
}: ShinyButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ size }), className)}
      onClick={onClick}
      type={type}
    >
      {/* Shadow */}
      <div className={cn(shadowVariants({ size }), shadowClassName)} />
      {/* Hover highlight */}
      <div className="opacity-0 group-hover:opacity-50 absolute inset-0 bg-gradient-to-b from-white/25 to-white/90 inset-shadow-shiny-highlight transition-opacity duration-300 ease-in-out dark:from-black/20 dark:to-white/40" />
      {/* Label */}
      <span className="relative flex items-center justify-center text-center drop-shadow-shiny-label group-hover:drop-shadow-shiny-label-hover transition-all duration-300 ease-in-out text-text-primary">
        {children}
      </span>
    </button>
  );
}
