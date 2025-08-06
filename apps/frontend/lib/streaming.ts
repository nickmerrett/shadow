import { useCallback } from "react";
import { AssistantMessagePart } from "@repo/types";
import { ToolCallPart, ToolResultPart } from "ai";

export function createStreamingPartAdder(
  setStreamingPartsMap: (
    updater: (
      prev: Map<string, AssistantMessagePart>
    ) => Map<string, AssistantMessagePart>
  ) => void,
  setStreamingPartsOrder: (updater: (prev: string[]) => string[]) => void
) {
  return useCallback(
    (part: AssistantMessagePart, id: string) => {
      setStreamingPartsMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(id, part);
        return newMap;
      });
      setStreamingPartsOrder((prev) =>
        prev.includes(id) ? prev : [...prev, id]
      );
    },
    [setStreamingPartsMap, setStreamingPartsOrder]
  );
}

export function createStreamingStateCleaner(
  setStreamingPartsMap: (map: Map<string, AssistantMessagePart>) => void,
  setStreamingPartsOrder: (order: string[]) => void,
  setIsStreaming: (streaming: boolean) => void
) {
  return useCallback(() => {
    setStreamingPartsMap(new Map());
    setStreamingPartsOrder([]);
    setIsStreaming(false);
  }, [setStreamingPartsMap, setStreamingPartsOrder, setIsStreaming]);
}

/**
 * Prevents duplicate tool-call/tool-result pairs when joining mid-stream
 */
export function deduplicatePartsFromMap(
  existingParts: AssistantMessagePart[],
  streamingPartsMap: Map<string, AssistantMessagePart>,
  streamingPartsOrder: string[]
): AssistantMessagePart[] {
  // Create set of existing tool call IDs for O(1) lookup
  const existingToolIds = new Set(
    existingParts
      .filter((p): p is ToolCallPart | ToolResultPart => "toolCallId" in p)
      .map((p) => p.toolCallId)
  );

  // Iterate through streaming parts in order, filtering duplicates - O(n) where n = streaming parts
  const newParts: AssistantMessagePart[] = [];
  for (const id of streamingPartsOrder) {
    const part = streamingPartsMap.get(id);
    if (part) {
      if ("toolCallId" in part) {
        if (!existingToolIds.has(part.toolCallId)) {
          newParts.push(part);
        }
      } else {
        newParts.push(part); // Always include text and error parts (they don't duplicate)
      }
    }
  }

  return [...existingParts, ...newParts];
}

/**
 * Converts Map storage to parts array in the correct order
 */
export function convertMapToPartsArray(
  streamingPartsMap: Map<string, AssistantMessagePart>,
  streamingPartsOrder: string[]
): AssistantMessagePart[] {
  const streamingParts: AssistantMessagePart[] = [];
  for (const id of streamingPartsOrder) {
    const part = streamingPartsMap.get(id);
    if (part) {
      streamingParts.push(part);
    }
  }
  return streamingParts;
}
