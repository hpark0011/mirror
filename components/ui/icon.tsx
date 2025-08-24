import React from "react";
import * as Icons from "@/icons";

export type IconName = keyof typeof Icons;

export interface IconProps {
  name: IconName;
  className?: string;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({ name, className = "", style }) => {
  const IconComponent = Icons[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return <IconComponent className={`${className}`} style={style} />;
};
