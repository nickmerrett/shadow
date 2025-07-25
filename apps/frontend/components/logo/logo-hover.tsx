"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import "./logo-animation.css";

const sizes = {
  sm: {
    width: 16,
    height: 16,
    className: "logo-sm",
  },
  md: {
    width: 20,
    height: 20,
    className: "logo-md",
  },
  lg: {
    width: 25,
    height: 25,
    className: "logo-lg",
  },
};

export function LogoHover({
  forceAnimate,
  size = "md",
  className,
}: {
  forceAnimate?: boolean;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [isAnimating, setIsAnimating] = useState(false);

  const shouldAnimate = forceAnimate !== undefined ? forceAnimate : isAnimating;

  return (
    <div
      className={cn("overflow-hidden", className)}
      style={{ width: sizes[size].width, height: sizes[size].height }}
    >
      <div
        className={cn("logo-container", sizes[size].className)}
        role="img"
        aria-label="Logo"
        data-animate={shouldAnimate.toString()}
        onMouseEnter={() => {
          if (forceAnimate === undefined) {
            setIsAnimating(true);
          }
        }}
        onMouseLeave={() => {
          if (forceAnimate === undefined) {
            setIsAnimating(false);
          }
        }}
      />
    </div>
  );
}
