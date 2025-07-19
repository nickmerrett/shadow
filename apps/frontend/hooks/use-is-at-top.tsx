import { useEffect, useRef, useState } from "react";

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
