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

### ✅ What's Working (Phase 1 + Phase 2):
**Backend (Phase 1):**
- AI SDK reasoning chunks are captured and processed
- Reasoning content flows through server pipeline  
- WebSocket emits reasoning chunks to frontend clients
- Reasoning parts stored in database for persistence
- Multiple reasoning blocks per message handled correctly

**Frontend (Phase 2):**
- Frontend processes all reasoning chunk types correctly
- Reasoning content flows through to streaming parts map
- Multi-block reasoning works on frontend
- Stream state recovery works for reasoning content
- Ready for UI component consumption

**System-Wide:**
- TypeScript compilation passes for all packages
- No breaking changes to existing functionality
- Legacy "thinking" code completely removed

### 📋 Testing Completed:
- TypeScript type checking passes across all packages
- All packages compile successfully
- Frontend reasoning state management tested
- Stream state recovery logic implemented

### 🔍 How to Test:
1. **WebSocket Inspection**: Browser dev tools → Network → WS tab during Claude 4 chat
2. **Database Verification**: Check message metadata after stream completion  
3. **Console Monitoring**: Server logs show reasoning chunk processing
4. **Frontend State**: Console log streaming parts map to see reasoning parts

## Phase 2: Frontend Implementation (COMPLETED ✅)

### What Was Implemented:

1. **Frontend Parts Processing**: Updated `apps/frontend/hooks/socket/use-task-socket.ts`
   ✅ Added reasoning imports (`ReasoningPart`, `RedactedReasoningPart`)
   ✅ Added reasoning state tracking variables (`activeReasoningParts`, `reasoningCounter`)
   ✅ Updated `clearStreamingState` to reset reasoning state
   ✅ Implemented reasoning chunk handling in `onStreamChunk`:
   
   ```typescript
   case "reasoning":
     // Accumulates reasoning text for current block
     // Tracks reasoning block IDs for multiple blocks
     
   case "reasoning-signature":  
     // Finalizes current reasoning part with signature
     // Adds to streaming parts map and increments counter
     
   case "redacted-reasoning":
     // Adds complete redacted reasoning part immediately
   ```

2. **Stream State Recovery**: Updated `onStreamState` 
   ✅ Reconstruct reasoning parts from chunk history on reconnection
   ✅ Handle reasoning counter state properly during replay
   ✅ Process incomplete reasoning parts correctly
   ✅ Update frontend reasoning state to match replayed state

3. **Stream Completion Cleanup**: 
   ✅ Added cleanup logic in "complete" case to finalize remaining reasoning parts
   ✅ Removed legacy thinking display code from `assistant-message.tsx`
   ✅ All TypeScript compilation passes

### Implementation Details:

**Frontend State Management:**
- `activeReasoningParts: Map<number, ReasoningPart>` - tracks incomplete reasoning blocks
- `reasoningCounter: number` - provides unique IDs for reasoning blocks  
- State is reset in `clearStreamingState()` and properly managed during reconnection

**Multi-Block Reasoning Support:**
- Each reasoning block gets tracked separately by counter ID
- Signatures mark completion and finalize parts into streaming parts map
- Counter increments ensure unique block identification
- Incomplete parts are handled gracefully on stream completion

**Parts Integration:**
- Reasoning parts added to streaming parts map with stable IDs (`reasoning-${counter}`)
- Proper order maintained in `streamingPartsOrder`
- Follows existing patterns for part ID generation

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
- `apps/frontend/hooks/socket/use-task-socket.ts` ✅
- `apps/frontend/components/chat/assistant-message.tsx` ✅ (removed legacy thinking)

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

**Phase 3 (Future): UI Components**
When ready to display reasoning to users:
1. Create reasoning display components (expandable/collapsible)
2. Add reasoning parts rendering in `assistant-message.tsx`
3. Style reasoning blocks to differentiate from regular text
4. Add signature verification UI (optional)
5. Test end-to-end reasoning display

---

*Implementation completed: Phase 1 + Phase 2*  
*Last updated: 2025-08-08*
*Status: Ready for reasoning display UI (Phase 3)*