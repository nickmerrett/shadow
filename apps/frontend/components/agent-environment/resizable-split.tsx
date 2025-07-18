"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizableSplitProps {
  children: [React.ReactNode, React.ReactNode];
  direction: "horizontal" | "vertical";
  initialSplit?: number;
  minSize?: number;
  className?: string;
}

export const ResizableSplit: React.FC<ResizableSplitProps> = ({
  children,
  direction = "vertical",
  initialSplit = 50,
  minSize = 10,
  className = "",
}) => {
  const [splitPosition, setSplitPosition] = useState(initialSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const total = direction === "vertical" ? rect.height : rect.width;
      const position = direction === "vertical" ? e.clientY - rect.top : e.clientX - rect.left;
      
      const percentage = Math.min(
        100 - minSize,
        Math.max(minSize, (position / total) * 100)
      );
      
      setSplitPosition(percentage);
    },
    [isDragging, direction, minSize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = direction === "vertical" ? "row-resize" : "col-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp, direction]);

  const flexDirection = direction === "vertical" ? "flex-col" : "flex-row";
  const dividerClass = direction === "vertical" 
    ? "h-1 cursor-row-resize bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500" 
    : "w-1 cursor-col-resize bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500";

  return (
    <div
      ref={containerRef}
      className={`flex ${flexDirection} h-full ${className}`}
    >
      <div 
        style={{ 
          [direction === "vertical" ? "height" : "width"]: `${splitPosition}%` 
        }}
        className="overflow-hidden"
      >
        {children[0]}
      </div>
      
      <div
        ref={dividerRef}
        className={dividerClass}
        onMouseDown={handleMouseDown}
      />
      
      <div 
        style={{ 
          [direction === "vertical" ? "height" : "width"]: `${100 - splitPosition}%` 
        }}
        className="overflow-hidden"
      >
        {children[1]}
      </div>
    </div>
  );
};