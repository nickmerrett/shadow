"use client";

import { Messages } from "@/components/chat/messages";
import { PromptForm } from "@/components/chat/prompt-form";
import { socket } from "@/lib/socket";
import { useEffect, useState } from "react";
import { EXAMPLE_CHAT_HISTORY } from "./example-data";

export default function TaskPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState("N/A");
  const [accumulatedContent, setAccumulatedContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setTransport(socket.io.engine.transport.name);

      socket.io.engine.on("upgrade", (transport) => {
        setTransport(transport.name);
      });
    }

    function onDisconnect() {
      setIsConnected(false);
      setTransport("N/A");
    }

    function onStreamState(state: { content: string; isStreaming: boolean }) {
      console.log("Received stream state:", state);
      setAccumulatedContent(state.content);
      setIsStreaming(state.isStreaming);
    }

    function onStreamChunk(chunk: string) {
      setIsStreaming(true);

      // Parse OpenAI streaming format
      if (chunk.startsWith("data: ")) {
        try {
          const jsonStr = chunk.slice(6); // Remove 'data: ' prefix
          if (jsonStr.trim() === "[DONE]") {
            setIsStreaming(false);
            return;
          }

          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;

          if (content) {
            setAccumulatedContent((prev) => prev + content);
          }
        } catch (error) {
          // If parsing fails, just append the raw chunk
          setAccumulatedContent((prev) => prev + chunk);
        }
      } else {
        // Handle non-data chunks
        setAccumulatedContent((prev) => prev + chunk);
      }
    }

    function onStreamComplete() {
      setIsStreaming(false);
      console.log("Stream completed");
    }

    function onStreamError(error: any) {
      setIsStreaming(false);
      console.error("Stream error:", error);
      setAccumulatedContent((prev) => prev + "\n\nStream error occurred");
    }

    // Set up all event listeners first
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("stream-state", onStreamState);
    socket.on("stream-chunk", onStreamChunk);
    socket.on("stream-complete", onStreamComplete);
    socket.on("stream-error", onStreamError);

    // Now connect the socket - this ensures listeners are ready when stream-state is sent
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("stream-state", onStreamState);
      socket.off("stream-chunk", onStreamChunk);
      socket.off("stream-complete", onStreamComplete);
      socket.off("stream-error", onStreamError);
    };
  }, []);

  const socketTestComponent = (
    <div className="w-full h-[200vh] bg-red-500/5 p-4 mb-24">
      <div className="mb-4 space-y-2">
        <p>Status: {isConnected ? "connected" : "disconnected"}</p>
        <p>Transport: {transport}</p>
      </div>

      <div className="font-mono text-sm whitespace-pre-wrap text-red-300">
        {accumulatedContent || "Waiting for stream data..."}
        {isStreaming && <span className="animate-pulse">█</span>}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex w-full grow max-w-lg flex-col items-center">
      <Messages messages={EXAMPLE_CHAT_HISTORY} />
      <PromptForm />
    </div>
  );
}
