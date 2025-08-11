import { marked } from "marked";
import { memo, useMemo, useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { ShikiCode } from "@/components/ui/shiki-code";
import { useStickToBottom } from "use-stick-to-bottom";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    return (
      <div className="prose text-foreground prose-headings:font-medium prose-h1:text-2xl prose-sm prose-invert prose-neutral prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-muted-foreground prose-code:rounded-sm prose-code:border prose-code:bg-card prose-code:px-1 prose-code:before:content-none prose-code:after:content-none prose-code:font-normal prose-pre:p-0 prose-pre:bg-background max-w-none">
        <ReactMarkdown
          components={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            code: ({ inline, children, className, ...props }: any) => {
              const isInline = inline ?? !className;
              return (
                <ShikiCode
                  inline={isInline}
                  {...(className && { className })}
                  {...props}
                >
                  {String(children).replace(/\n$/, "")}
                </ShikiCode>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) return false;
    return true;
  }
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return (
      <div className="space-y-2">
        {blocks.map((block, index) => (
          <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
        ))}
      </div>
    );
  }
);

MemoizedMarkdown.displayName = "MemoizedMarkdown";

export function FadedMarkdown({
  content,
  id,
}: {
  content: string;
  id: string;
}) {
  const { scrollRef, contentRef, isAtBottom } = useStickToBottom();
  const [isAtTop, setIsAtTop] = useState(true);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Check if content overflows and scroll position
  useEffect(() => {
    const container = scrollRef.current;
    const content = contentRef.current;
    
    if (!container || !content) return;

    const checkOverflowAndPosition = () => {
      // Check if content height exceeds container height (accounting for max-h-96 = 384px)
      const containerHeight = container.clientHeight;
      const contentHeight = content.scrollHeight;
      const hasContentOverflow = contentHeight > containerHeight;
      setHasOverflow(hasContentOverflow);

      // Check if at top (within 10px buffer)
      const scrollTop = container.scrollTop;
      setIsAtTop(scrollTop <= 10);
    };

    checkOverflowAndPosition();

    // Listen to scroll events
    container.addEventListener('scroll', checkOverflowAndPosition);

    // Use ResizeObserver to detect content changes
    const resizeObserver = new ResizeObserver(checkOverflowAndPosition);
    resizeObserver.observe(content);

    return () => {
      container.removeEventListener('scroll', checkOverflowAndPosition);
      resizeObserver.disconnect();
    };
  }, [content, scrollRef, contentRef]);

  const showTopFade = hasOverflow && !isAtTop;
  const showBottomFade = hasOverflow && !isAtBottom;

  return (
    <div className="relative z-0 max-h-96 overflow-auto opacity-70" ref={scrollRef}>
      {/* Top fade */}
      {showTopFade && (
        <div className="from-background absolute top-0 left-0 z-10 h-24 w-full bg-gradient-to-b to-transparent pointer-events-none" />
      )}
      
      {/* Bottom fade */}
      {showBottomFade && (
        <div className="from-background absolute -bottom-px left-0 z-10 h-24 w-full bg-gradient-to-t to-transparent pointer-events-none" />
      )}
      
      <div className="space-y-2" ref={contentRef}>
        <MemoizedMarkdown content={content} id={id} />
      </div>
    </div>
  );
}
