import type { SVGProps } from "react";

export function ArrowshapeRightFillIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M24.5274 14C24.5274 13.668 24.4102 13.3066 24.0293 12.9453L16.3243 5.73828C15.8067 5.25 15.4844 5.04492 15.0059 5.04492C14.3223 5.04492 13.834 5.58203 13.834 6.23633V10.1523H5.71875C4.30273 10.1523 3.47266 10.9531 3.47266 12.3496V15.6601C3.47266 17.0566 4.30273 17.8574 5.71875 17.8574H13.834V21.8125C13.834 22.4668 14.3223 22.9551 14.9864 22.9551C15.4649 22.9551 15.8555 22.7597 16.3243 22.3203L24.0293 15.0449C24.4004 14.6934 24.5274 14.3223 24.5274 14Z"
        fill="currentColor"
      />
    </svg>
  );
}
