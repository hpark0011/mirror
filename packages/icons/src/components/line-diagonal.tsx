import { type SVGProps } from "react";

export function LineDiagonalIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M9.61719 23H8L18.3926 5H20.0098L9.61719 23Z" fill="currentColor"/>
    </svg>
  );
}
