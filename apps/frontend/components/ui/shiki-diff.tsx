"use client";

import { useEffect, useState, useMemo } from "react";
import { transformerNotationDiff } from "@shikijs/transformers";
import { BundledLanguage } from "shiki";
import { getHighlighter } from "@/lib/editor/highlighter";
import { cn } from "@/lib/utils";

interface ShikiDiffProps {
  content: string;
  language: BundledLanguage;
  className?: string;
}

export function ShikiDiff({ content, language, className }: ShikiDiffProps) {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Memoize the content and language to avoid unnecessary re-renders
  const memoizedContent = useMemo(() => content, [content]);
  const memoizedLanguage = useMemo(() => language, [language]);

  useEffect(() => {
    async function generateHighlightedCode() {
      try {
        setIsLoading(true);
        setError("");

        const highlighter = await getHighlighter();

        const highlightedHtml = highlighter.codeToHtml(memoizedContent, {
          lang: memoizedLanguage,
          theme: "vesper",
          transformers: [
            transformerNotationDiff({
              matchAlgorithm: "v3", // Use the newer matching algorithm
            }),
          ],
        });

        setHtml(highlightedHtml);
      } catch (err) {
        console.error("Failed to highlight code:", err);
        setError(
          err instanceof Error ? err.message : "Failed to highlight code"
        );
        // Fallback to plain text
        setHtml(`<pre><code>${escapeHtml(memoizedContent)}</code></pre>`);
      } finally {
        setIsLoading(false);
      }
    }

    if (memoizedContent) {
      generateHighlightedCode();
    }
  }, [memoizedContent, memoizedLanguage]);

  if (isLoading) {
    return (
      <div
        className={cn(
          "border-border not-prose overflow-auto rounded-md border p-3 font-mono text-xs [&_code]:border-none [&_code]:bg-transparent [&_code]:p-0",
          className
        )}
      >
        <div className="text-muted-foreground flex items-center gap-2">
          <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Generating diff...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "border-border not-prose overflow-auto rounded-md border p-3 font-mono text-xs [&_code]:border-none [&_code]:bg-transparent [&_code]:p-0",
          className
        )}
      >
        <code>{memoizedContent}</code>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "shiki-diff-container border-border not-prose overflow-auto rounded-md border font-mono text-xs",
        "[&_.diff.add]:bg-green-50 [&_.diff.add]:dark:bg-green-950/30",
        "[&_.diff.remove]:bg-red-50 [&_.diff.remove]:dark:bg-red-950/30",
        "[&_code]:border-none [&_code]:bg-transparent [&_code]:p-0",
        "[&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-3",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Utility function to escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Simplified version that just shows before/after without syntax highlighting
interface SimpleDiffProps {
  oldString: string;
  newString: string;
  className?: string;
}

export function SimpleDiff({
  oldString,
  newString,
  className,
}: SimpleDiffProps) {
  return (
    <div
      className={cn(
        "bg-muted overflow-hidden rounded-md border font-mono text-xs",
        className
      )}
    >
      <div className="space-y-1 p-4">
        {oldString.split("\n").map((line, i) => (
          <div key={`old-${i}`} className="flex">
            <span className="text-destructive mr-2">-</span>
            <span className="flex-1 bg-red-50 px-1 dark:bg-red-950/30">
              {line}
            </span>
          </div>
        ))}
        {newString.split("\n").map((line, i) => (
          <div key={`new-${i}`} className="flex">
            <span className="mr-2 text-green-600">+</span>
            <span className="flex-1 bg-green-50 px-1 dark:bg-green-950/30">
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
