import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

export function useIsAtTop<T extends HTMLElement = HTMLDivElement>(
  offset: number = 16,
  externalRef?: React.RefObject<T | null>
) {
  const [isAtTop, setIsAtTop] = useState(true);
  const internalRef = useRef<T>(null);
  const elementRef = externalRef || internalRef;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleScroll = () => {
      setIsAtTop(element.scrollTop <= offset);
    };

    handleScroll();

    element.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [offset, elementRef]);

  return { isAtTop, elementRef: internalRef };
}

export function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  return (
    <Tooltip disableHoverableContent={isAtBottom}>
      <TooltipTrigger asChild>
        <button
          disabled={isAtBottom}
          className={cn(
            "sticky bg-background border border-border rounded-full p-1.5 hover:bg-accent z-20 text-muted-foreground hover:text-foreground transition-all",
            isAtBottom
              ? "opacity-0 translate-y-2"
              : "opacity-100 translate-y-0 cursor-pointer",
            "bottom-38"
          )}
          onClick={() => scrollToBottom()}
        >
          <ArrowDown className="size-4" />
        </button>
      </TooltipTrigger>
      {!isAtBottom && <TooltipContent>Scroll to Bottom</TooltipContent>}
    </Tooltip>
  );
}
