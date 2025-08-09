import type { Message } from "@repo/types";
import { ToolComponent } from "./tool";
import { MemoizedMarkdown } from "../memoized-markdown";
import { ToolTypes, getMCPToolTitle, getMCPToolPrefix } from "@repo/types";
import { MCPLogo } from "@/components/graphics/icons/mcp-logo";

export function MCPTool({ message }: { message: Message }) {
  const toolMeta = message.metadata?.tool;
  if (!toolMeta) return null;

  // Get custom title and prefix using utility functions
  const title = getMCPToolTitle(toolMeta.name, toolMeta.args || {});
  const prefix = getMCPToolPrefix(toolMeta.name);

  const renderMarkdownOnly = () => {
    if (!toolMeta.result) {
      return null;
    }

    if (typeof toolMeta.result === "string") {
      return (
        <FadedMarkdown
          content={(toolMeta.result as string).slice(0, 800)}
          id={`mcp-${message.id}`}
        />
      );
    }

    if (typeof toolMeta.result === "object") {
      const result = toolMeta.result;

      // Handle Context7 format with content array - show content[0].text
      if (
        "content" in result &&
        Array.isArray(result.content) &&
        result.content.length > 0
      ) {
        const firstContent = result.content[0];
        if (
          firstContent &&
          typeof firstContent === "object" &&
          "text" in firstContent
        ) {
          return (
            <FadedMarkdown
              content={(firstContent.text as string).slice(0, 800)}
              id={`mcp-content-${message.id}`}
            />
          );
        }
      }

      if ("content" in result && typeof result.content === "string") {
        return (
          <FadedMarkdown
            content={(result.content as string).slice(0, 800)}
            id={`mcp-content-${message.id}`}
          />
        );
      }
    }

    return null;
  };

  return (
    <ToolComponent
      type={ToolTypes.MCP}
      icon={<MCPLogo />}
      title={title}
      prefix={prefix}
      collapsible={true}
    >
      {/* ONLY the markdown content - no headers, no arguments, no status */}
      {renderMarkdownOnly()}
    </ToolComponent>
  );
}

function FadedMarkdown({ content, id }: { content: string; id: string }) {
  return (
    <div className="relative z-0 max-h-96 overflow-hidden opacity-70">
      <div className="to-background absolute -bottom-px left-0 z-10 h-24 w-full bg-gradient-to-b from-transparent" />
      <div className="to-background absolute -top-px left-0 z-10 h-24 w-full bg-gradient-to-t from-transparent" />
      <MemoizedMarkdown content={content} id={id} />
    </div>
  );
}
