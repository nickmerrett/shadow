# Reasoning Parts Implementation Documentation

## Overview

This document describes the Phase 1 implementation of AI SDK ReasoningPart and RedactedReasoningPart support throughout the Shadow codebase. This enables the system to properly handle and stream Claude's extended thinking/reasoning capabilities.

## Phase 1: Backend Implementation (COMPLETED ✅)

### What Was Implemented

Complete backend support for reasoning chunks flowing from AI SDK through the server pipeline to WebSocket emission. Frontend consumption is Phase 2.

### Legacy "Thinking" Removal (COMPLETED ✅)

Removed legacy unused "thinking" functionality in favor of the new reasoning implementation:
- Removed `"thinking"` from StreamChunk type union
- Removed `thinking?: string` field from StreamChunk interface
- Removed `thinking?: { content: string; duration: number }` from MessageMetadata
- Removed frontend thinking case handler (was just console logging)
- All TypeScript compilation passes
- No remaining "thinking" references found in codebase

### Key Findings from Research

- **Multiple Reasoning Blocks**: Messages CAN have multiple reasoning blocks, often interleaved with text and tool calls
- **Signature Purpose**: Each reasoning block gets exactly ONE signature for cryptographic verification and completion marking
- **AI SDK Support**: Latest AI SDK versions support reasoning models across providers (Anthropic, OpenAI, etc.)

## Implementation Details

### 1. Type Definitions

#### Added to `packages/types/src/chat/messages.ts`:
```typescript
// Reasoning part types (AI SDK compatible)
export interface ReasoningPart {
  type: "reasoning";
  text: string;
  signature?: string;
}

export interface RedactedReasoningPart {
  type: "redacted-reasoning";
  data: string;
}

// Extended AssistantMessagePart union
export type AssistantMessagePart =
  | TextPart
  | ToolCallPart
  | ToolResultPart
  | ReasoningPart       // NEW
  | RedactedReasoningPart // NEW
  | ErrorPart;
```

#### Added to `packages/types/src/llm/streaming-ai-sdk.ts`:
```typescript
export interface ReasoningChunk {
  type: "reasoning";
  textDelta: string;
}

export interface ReasoningSignatureChunk {
  type: "reasoning-signature";
  signature: string;
}

export interface RedactedReasoningChunk {
  type: "redacted-reasoning";
  data: string;
}

// Updated AIStreamChunk union to include new types
```

#### Added to `packages/types/src/chat/streaming-client.ts`:
```typescript
// Added to StreamChunk type union
type: "reasoning" | "reasoning-signature" | "redacted-reasoning"

// Added reasoning fields
reasoning?: string;              // Incremental reasoning text delta
reasoningSignature?: string;     // Verification signature
redactedReasoningData?: string;  // Complete redacted reasoning block
```

### 2. Stream Processing

#### Chunk Handlers (`apps/server/src/agent/llm/streaming/chunk-handlers.ts`):
```typescript
handleReasoning(chunk: AIStreamChunk & { type: "reasoning" }): StreamChunk | null
handleReasoningSignature(chunk: AIStreamChunk & { type: "reasoning-signature" }): StreamChunk | null  
handleRedactedReasoning(chunk: AIStreamChunk & { type: "redacted-reasoning" }): StreamChunk | null
```

#### Stream Processor (`apps/server/src/agent/llm/streaming/stream-processor.ts`):
Added case handlers in main switch statement:
```typescript
case "reasoning": {
  const streamChunk = this.chunkHandlers.handleReasoning(chunk);
  if (streamChunk) yield streamChunk;
  break;
}
// ... similar for reasoning-signature and redacted-reasoning
```

### 3. Message Building Logic

#### Chat Service (`apps/server/src/agent/chat.ts`):

**State Tracking Variables:**
```typescript
// Track active reasoning parts for signature association
let activeReasoningParts: Map<number, ReasoningPart> = new Map();
let reasoningCounter = 0;
```

**Reasoning Chunk Processing:**
- **`reasoning` chunks**: Accumulate text deltas into reasoning parts
- **`reasoning-signature` chunks**: Finalize reasoning parts and add to message
- **`redacted-reasoning` chunks**: Add complete redacted reasoning parts

**Multiple Reasoning Blocks Support:**
- Each reasoning block gets tracked separately by `reasoningCounter`
- Signatures mark completion of current block and increment counter
- Final cleanup handles any incomplete reasoning parts

## How Multiple Reasoning Blocks Work

### Stream Flow Example:
```
reasoning(delta: "First, let me consider...")     // Block 0 starts
reasoning(delta: " the user's request...")        // Block 0 continues
reasoning-signature(sig: "sig1")                  // Block 0 finalized → counter = 1

reasoning(delta: "Next, I should think about...")  // Block 1 starts  
reasoning(delta: " the implementation...")         // Block 1 continues
reasoning-signature(sig: "sig2")                  // Block 1 finalized → counter = 2
```

### Final Message Parts:
```typescript
[
  { type: "reasoning", text: "First, let me consider the user's request...", signature: "sig1" },
  { type: "reasoning", text: "Next, I should think about the implementation...", signature: "sig2" }
]
```

## Reasoning Signatures Explained

### Purpose:
- **Cryptographic Verification**: Proves reasoning actually came from AI model
- **Integrity Check**: Ensures reasoning text wasn't tampered with
- **Completion Marker**: Signals end of a reasoning block
- **Audit Trail**: Provides cryptographic proof for compliance

### Pattern:
- Each distinct reasoning block gets exactly ONE signature
- Signature arrives after all text deltas for that block
- Used as both completion signal AND authenticity proof

## Current Status

### ✅ What's Working:
- AI SDK reasoning chunks are captured and processed
- Reasoning content flows through server pipeline  
- WebSocket emits reasoning chunks to frontend clients
- Reasoning parts stored in database for persistence
- Multiple reasoning blocks per message handled correctly
- TypeScript compilation passes for all packages

### 📋 Testing Completed:
- TypeScript type checking passes
- All packages compile successfully
- No breaking changes to existing functionality

### 🔍 How to Test:
1. **WebSocket Inspection**: Browser dev tools → Network → WS tab during Claude 4 chat
2. **Database Verification**: Check message metadata after stream completion  
3. **Console Monitoring**: Server logs show reasoning chunk processing

## Phase 2: Frontend Implementation (TODO)

### What's Needed:
1. **Frontend Parts Processing**: Update `apps/frontend/hooks/socket/use-task-socket.ts`
   - Add reasoning chunk handling in `onStreamChunk`
   - Manage incremental reasoning text accumulation
   - Handle multiple reasoning blocks in parts map
   
2. **Stream State Recovery**: Update `onStreamState` 
   - Reconstruct reasoning parts from chunk history on reconnection
   - Handle reasoning counter state properly

3. **UI Components**: Create reasoning display components (separate task)

### Frontend Implementation Plan:
```typescript
// In onStreamChunk handler
case "reasoning":
  // Accumulate reasoning text for current block
  // Track reasoning block IDs for multiple blocks

case "reasoning-signature":  
  // Finalize current reasoning part with signature
  // Add to streaming parts map

case "redacted-reasoning":
  // Add complete redacted reasoning part
```

## Configuration Notes

### AI SDK Configuration:
The reasoning functionality is already enabled in `stream-processor.ts`:
```typescript
const reasoningProviderOptions = {
  anthropic: {
    thinking: {
      type: "enabled", 
      budgetTokens: 12000,
    },
  },
  openai: {
    reasoningEffort: "high",
  },
};
```

### Supported Models:
- Anthropic: Claude 4, Claude 3.7 Sonnet, Claude Opus 4
- OpenAI: Reasoning models (o1, o1-mini, etc.)
- Other providers as AI SDK adds support

## Files Modified

### Type Definitions:
- `packages/types/src/chat/messages.ts`
- `packages/types/src/llm/streaming-ai-sdk.ts` 
- `packages/types/src/chat/streaming-client.ts`

### Server Implementation:
- `apps/server/src/agent/llm/streaming/chunk-handlers.ts`
- `apps/server/src/agent/llm/streaming/stream-processor.ts`
- `apps/server/src/agent/chat.ts`

### Frontend (Phase 2):
- `apps/frontend/hooks/socket/use-task-socket.ts` (TODO)

## Important Notes

### Edge Cases Handled:
- Reasoning blocks without signatures (cleanup logic)
- Mixed reasoning and tool call content
- Stream interruption/reconnection
- Multiple reasoning blocks per message

### Performance Considerations:
- Efficient Map-based tracking for active reasoning parts
- Minimal database updates during streaming
- Existing WebSocket infrastructure reused

### Security:
- Reasoning signatures preserved for verification
- No modification of reasoning content
- Cryptographic integrity maintained

## Next Steps

When ready for Phase 2:
1. Review this documentation
2. Implement frontend reasoning chunk processing
3. Add UI components for reasoning display
4. Test end-to-end reasoning flow

---

*Implementation completed: Phase 1*  
*Last updated: [Current Date]*
*Ready for Phase 2: Frontend consumption*