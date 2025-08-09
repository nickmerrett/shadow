# Shiki Streaming Implementation Plan

## Problem Statement
Currently, streaming text in code blocks causes flashing between highlighted and unhighlighted states because the `ShikiCode` component re-highlights the entire content on every text change, causing a loading state flash.

## Solution
Implement `shiki-stream` library to provide true streaming syntax highlighting without the flash effect.

## Implementation Steps

### 1. Install Dependencies
```bash
npm install shiki-stream
```

### 2. Create Streaming Highlighter Utility
**File**: `apps/frontend/lib/editor/streaming-highlighter.ts`

- Export function to create `CodeToTokenTransformStream`
- Integrate with existing singleton highlighter from `getHighlighter()`
- Handle stream creation for different languages/themes

### 3. Create StreamingShikiCode Component
**File**: `apps/frontend/components/ui/streaming-shiki-code.tsx`

- Use `ShikiStreamRenderer` from `shiki-stream/react`
- Handle recall tokens for context-aware highlighting
- Manage streaming state and error handling
- Provide same props interface as existing `ShikiCode`

### 4. Update Existing Components
Modify components that display code blocks to detect streaming vs static content:

#### `apps/frontend/components/ui/shiki-code.tsx`
- Add detection logic for streaming content
- Switch between static and streaming renderers

#### `apps/frontend/components/agent-environment/markdown-renderer.tsx`
- Update code block rendering to use new streaming logic
- Maintain backward compatibility

#### `apps/frontend/components/chat/memoized-markdown.tsx`
- Update to use streaming-aware code rendering
- Handle streaming LLM responses

### 5. Stream Detection Logic
Create utility functions to:
- Detect if content is being streamed (rapid updates)
- Determine when to switch from streaming to static rendering
- Handle edge cases and fallbacks

### 6. Integration Points
- Identify all places where streaming code content appears:
  - Chat messages with code blocks
  - Agent environment outputs
  - LLM streaming responses
  - Any other real-time code display

### 7. Testing & Optimization
- Test with actual streaming LLM responses
- Verify no flashing occurs during streaming
- Ensure graceful fallback for edge cases
- Performance testing with long code blocks
- Memory usage optimization for long streams

## Technical Considerations

### Recall Handling
The `shiki-stream` library uses a "recall" system where tokens can be invalidated as more context arrives. Need to handle:
- Token buffer management
- Recall event processing
- UI updates without flickering

### Performance
- Stream processing should not block UI
- Memory management for long streams
- Debouncing for rapid updates

### Backward Compatibility
- Existing `ShikiCode` component should continue working
- Non-streaming content should use optimized static path
- No breaking changes to existing API

## Success Criteria
1. ✅ No flashing during streaming code highlighting
2. ✅ Syntax highlighting remains accurate during streaming
3. ✅ Performance is maintained or improved
4. ✅ Existing non-streaming code blocks continue to work
5. ✅ Graceful error handling and fallbacks
6. ✅ Memory usage remains reasonable for long streams

## Rollback Plan
If issues arise:
1. Feature flag to disable streaming highlighting
2. Fallback to existing `ShikiCode` implementation
3. Incremental rollout to specific components first