import { type SVGProps } from "react";

export function MinusSmallIcon(
  { className, ...props }: SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M9.98461 15H18.0257C18.6 15 19 14.6429 19 14.0119C19 13.369 18.6307 13 18.0257 13H9.98461C9.38975 13 9 13.369 9 14.0119C9 14.6429 9.41026 15 9.98461 15Z"
        fill="currentColor"
      />
    </svg>
  );
}
