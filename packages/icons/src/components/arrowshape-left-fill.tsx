import type { SVGProps } from "react";

export function ArrowshapeLeftFillIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M3.47266 14C3.47266 14.3223 3.59961 14.6934 3.9707 15.0449L11.6758 22.3203C12.1445 22.7597 12.5352 22.9551 13.0137 22.9551C13.6778 22.9551 14.1563 22.4668 14.1563 21.8125V17.8574H22.2813C23.6973 17.8574 24.5274 17.0566 24.5274 15.6601V12.3496C24.5274 10.9531 23.6973 10.1523 22.2813 10.1523H14.1563V6.23633C14.1563 5.58203 13.6778 5.04492 12.9941 5.04492C12.5156 5.04492 12.1934 5.25 11.6758 5.73828L3.9707 12.9453C3.58984 13.3066 3.47266 13.668 3.47266 14Z"
        fill="currentColor"
      />
    </svg>
  );
}
