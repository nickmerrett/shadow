"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import "./logo-animation.css";

const sizes = {
  sm: {
    width: 20,
    height: 20,
  },
  lg: {
    width: 25,
    height: 25,
  },
};

export function LogoHover({
  forceAnimate,
  size = "sm",
}: {
  forceAnimate?: boolean;
  size?: keyof typeof sizes;
}) {
  const [isAnimating, setIsAnimating] = useState(false);

  const shouldAnimate = forceAnimate !== undefined ? forceAnimate : isAnimating;

  return (
    <div
      className="overflow-hidden"
      style={{ width: sizes[size].width, height: sizes[size].height }}
    >
      <div
        className={cn("logo-container", size === "sm" ? "logo-sm" : "logo-lg")}
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
