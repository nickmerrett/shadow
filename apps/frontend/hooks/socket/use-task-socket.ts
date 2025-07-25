"use client";

import { useSocket } from "./use-socket";
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { 
  AssistantMessagePart, 
  Message, 
  StreamChunk, 
  TaskStatusUpdateEvent,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  ModelType
} from "@repo/types";

interface FileChange {
  filePath: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'RENAME';
  additions: number;
  deletions: number;
  createdAt: string;
}

interface FsChangeEvent {
  operation: 'file-created' | 'file-modified' | 'file-deleted' | 'directory-created' | 'directory-deleted';
  filePath: string;
  timestamp: number;
  source: 'local' | 'remote';
  isDirectory: boolean;
}

/**
 * Optimistically update file changes array based on filesystem events
 */
function updateFileChangesOptimistically(
  existingChanges: FileChange[],
  fsChange: FsChangeEvent
): FileChange[] {
  const { operation, filePath, isDirectory } = fsChange;
  
  console.log(`[OPTIMISTIC_UPDATE] ${operation} ${filePath} (isDirectory: ${isDirectory})`);
  
  // Skip directory changes for now (we focus on files)
  if (isDirectory) {
    console.log(`[OPTIMISTIC_UPDATE] Skipping directory change: ${filePath}`);
    return existingChanges;
  }
  
  // Remove existing entry for this file (if any)
  const filtered = existingChanges.filter(change => change.filePath !== filePath);
  const wasExisting = filtered.length !== existingChanges.length;
  
  // Handle each operation type
  switch (operation) {
    case 'file-created':
      console.log(`[OPTIMISTIC_UPDATE] Adding new file: ${filePath}`);
      return [...filtered, {
        filePath,
        operation: 'CREATE',
        additions: 0, // Will be updated by background git refresh
        deletions: 0,
        createdAt: new Date().toISOString()
      }];
      
    case 'file-modified':
      console.log(`[OPTIMISTIC_UPDATE] Updating existing file: ${filePath} (was existing: ${wasExisting})`);
      return [...filtered, {
        filePath,
        operation: wasExisting ? 'UPDATE' : 'CREATE', // Could be new file being written
        additions: 0, // Will be updated by background git refresh
        deletions: 0,
        createdAt: new Date().toISOString()
      }];
      
    case 'file-deleted':
      console.log(`[OPTIMISTIC_UPDATE] Removing deleted file: ${filePath}`);
      // For deletions, just return filtered array (file removed from list)
      return filtered;
      
    case 'directory-created':
    case 'directory-deleted':
      // Should not reach here due to isDirectory check above, but handle gracefully
      console.log(`[OPTIMISTIC_UPDATE] Ignoring directory operation: ${operation} ${filePath}`);
      return existingChanges;
      
    default:
      console.warn(`[OPTIMISTIC_UPDATE] Unknown operation: ${operation} ${filePath}`);
      return existingChanges;
  }
}

export function useTaskSocket(taskId: string | undefined) {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  
  // All the state that was previously in task-content.tsx
  const [streamingAssistantParts, setStreamingAssistantParts] = useState<AssistantMessagePart[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Join/leave task room
  useEffect(() => {
    if (socket && taskId && isConnected) {
      socket.emit('join-task', { taskId });
      console.log(`[SOCKET] Joined task room: ${taskId}`);
      
      return () => {
        socket.emit('leave-task', { taskId });
        console.log(`[SOCKET] Left task room: ${taskId}`);
      };
    }
  }, [socket, taskId, isConnected]);

  // All the chat event handlers (moved from task-content.tsx)
  useEffect(() => {
    if (!socket || !taskId) return;

    function onConnect() {
      // Request chat history when connected - taskId is guaranteed to be defined here
      socket.emit("get-chat-history", { taskId: taskId as string });
    }

    function onDisconnect() {
      // Connection lost
      console.log("[TASK-SOCKET] Disconnected");
    }

    function onChatHistory(data: { taskId: string; messages: Message[] }) {
      if (data.taskId === taskId) {
        // Update the query cache directly with fresh data from server
        queryClient.setQueryData(["task-messages", taskId], data.messages);

        // Clear streaming state when we have the updated chat history
        setStreamingAssistantParts([]);
        setIsStreaming(false);
      }
    }

    function onStreamState(state: { content: string; isStreaming: boolean }) {
      console.log("Received stream state:", state);
      setIsStreaming(state.isStreaming);
    }

    function onStreamChunk(chunk: StreamChunk) {
      setIsStreaming(true);

      // Handle different types of stream chunks
      switch (chunk.type) {
        case "content":
          if (chunk.content) {
            // Add text part to structured assistant parts
            const textPart: TextPart = {
              type: "text",
              text: chunk.content,
            };
            setStreamingAssistantParts((prev) => [...prev, textPart]);
          }
          break;

        case "tool-call":
          if (chunk.toolCall) {
            console.log("Tool call:", chunk.toolCall);

            // Add tool call part to structured assistant parts
            const toolCallPart: ToolCallPart = {
              type: "tool-call",
              toolCallId: chunk.toolCall.id,
              toolName: chunk.toolCall.name,
              args: chunk.toolCall.args,
            };
            setStreamingAssistantParts((prev) => [...prev, toolCallPart]);
          }
          break;

        case "tool-result":
          if (chunk.toolResult) {
            console.log("Tool result:", chunk.toolResult);

            // Add tool result part to structured assistant parts
            const toolResultPart: ToolResultPart = {
              type: "tool-result",
              toolCallId: chunk.toolResult.id,
              toolName: "", // We'll find the tool name from the corresponding call
              result: chunk.toolResult.result,
            };

            // Find the corresponding tool call to get the tool name
            setStreamingAssistantParts((prev) => {
              const correspondingCall = prev.find(
                (part) =>
                  part.type === "tool-call" &&
                  part.toolCallId === chunk.toolResult!.id
              );
              if (correspondingCall && correspondingCall.type === "tool-call") {
                toolResultPart.toolName = correspondingCall.toolName;
              }
              return [...prev, toolResultPart];
            });
          }
          break;

        case "fs-change":
          if (chunk.fsChange) {
            console.log("File system change:", chunk.fsChange);
            
            // Optimistically update file changes in React Query cache
            queryClient.setQueryData(
              ["task", taskId],
              (oldData: any) => {
                if (!oldData) return oldData;
                
                // Add/update/remove from fileChanges array based on operation
                const updatedFileChanges = updateFileChangesOptimistically(
                  oldData.fileChanges || [],
                  chunk.fsChange!
                );
                
                return {
                  ...oldData,
                  fileChanges: updatedFileChanges
                };
              }
            );
            
            // Note: Diff stats are NOT invalidated here to avoid expensive git operations
            // They will refresh on: 1) stream completion, 2) 30s stale time, 3) manual refresh
          }
          break;

        case "complete":
          setIsStreaming(false);
          console.log("Stream completed");
          if (taskId) {
            socket.emit("get-chat-history", { taskId: taskId as string });
          }
          break;

        case "error": {
          setIsStreaming(false);
          console.error("Stream error:", chunk.error);

          // Add error text part to structured assistant parts
          const errorTextPart: TextPart = {
            type: "text",
            text: `\n\nError: ${chunk.error}`,
          };
          setStreamingAssistantParts((prev) => [...prev, errorTextPart]);
          break;
        }

        case "usage":
          console.log("Usage:", chunk.usage);
          break;

        case "thinking":
          console.log("Thinking:", chunk.thinking);
          break;
      }
    }

    function onStreamComplete() {
      setIsStreaming(false);
      console.log("Stream completed");
      // Refresh messages when stream is complete
      if (taskId) {
        socket.emit("get-chat-history", { taskId: taskId as string });
      }

      console.log(`[STREAM_COMPLETE] Invalidating queries for completed stream, task: ${taskId}`);
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // Refresh diff stats after LLM completion for accuracy
      console.log(`[STREAM_COMPLETE] Invalidating diff stats for accuracy after LLM completion`);
      queryClient.invalidateQueries({ queryKey: ["task-diff-stats", taskId] });
    }

    function onStreamError(error: any) {
      setIsStreaming(false);
      console.error("Stream error:", error);

      // Add error to structured parts
      const errorTextPart: TextPart = {
        type: "text",
        text: "\n\nStream error occurred",
      };
      setStreamingAssistantParts((prev) => [...prev, errorTextPart]);
    }

    function onMessageError(data: { error: string }) {
      console.error("Message error:", data.error);
      setIsStreaming(false);
    }

    function onTaskStatusUpdate(data: TaskStatusUpdateEvent) {
      if (data.taskId === taskId) {
        // Optimistically update the task status in React Query cache
        queryClient.setQueryData(
          ["task", taskId],
          (oldData: any) => {
            if (oldData) {
              return {
                ...oldData,
                status: data.status,
                updatedAt: data.timestamp,
              };
            }
            return oldData;
          }
        );

        queryClient.setQueryData(["tasks"], (oldTasks: any[]) => {
          if (oldTasks) {
            return oldTasks.map((task: any) =>
              task.id === taskId
                ? { ...task, status: data.status, updatedAt: data.timestamp }
                : task
            );
          }
          return oldTasks;
        });
      }
    }

    // Register all event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('chat-history', onChatHistory);
    socket.on('stream-state', onStreamState);
    socket.on('stream-chunk', onStreamChunk);
    socket.on('stream-complete', onStreamComplete);
    socket.on('stream-error', onStreamError);
    socket.on('message-error', onMessageError);
    socket.on('task-status-updated', onTaskStatusUpdate);

    return () => {
      // Cleanup all listeners
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('chat-history', onChatHistory);
      socket.off('stream-state', onStreamState);
      socket.off('stream-chunk', onStreamChunk);
      socket.off('stream-complete', onStreamComplete);
      socket.off('stream-error', onStreamError);
      socket.off('message-error', onMessageError);
      socket.off('task-status-updated', onTaskStatusUpdate);
    };
  }, [socket, taskId, queryClient]);

  // Socket actions (methods to call from components)
  const sendMessage = useCallback((message: string, model: string) => {
    if (!socket || !taskId || !message.trim()) return;
    
    console.log("Sending message:", { taskId, message, model });
    socket.emit('user-message', {
      taskId,
      message: message.trim(),
      llmModel: model as ModelType,
    });
  }, [socket, taskId]);

  const stopStream = useCallback(() => {
    if (!socket || !taskId || !isStreaming) return;
    
    console.log("Stopping stream for task:", taskId);
    socket.emit('stop-stream', { taskId });
    setIsStreaming(false);
    setStreamingAssistantParts([]);
  }, [socket, taskId, isStreaming]);

  return {
    // Connection state
    isConnected,
    
    // Chat state
    streamingAssistantParts,
    isStreaming,
    
    // Actions
    sendMessage,
    stopStream,
  };
}