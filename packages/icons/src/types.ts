import { type SVGProps } from "react";

/**
 * Props for icon components, extending standard SVG props.
 * All icons accept className for styling with Tailwind/CSS.
 *
 * @example
 * <ArrowDownIcon className="size-4 text-blue-500" />
 * <CheckmarkIcon style={{ color: "green" }} onClick={handleClick} />
 */
export interface IconProps extends SVGProps<SVGSVGElement> {
  className?: string;
}
