# Database Migration Required

## Changes Made
- Added `sequence INT` field to `ChatMessage` table for proper message ordering
- Added index on `[taskId, sequence]` for efficient ordered retrieval
- Updated ordering in queries from `createdAt` only to `sequence, createdAt`

## Migration Commands
Run these commands to update the database:

```bash
cd packages/db
npx prisma db push
npx prisma generate
```

## Why This Change
The previous system relied on `createdAt` timestamps for message ordering, but when multiple messages are saved in rapid succession (like during tool execution), their timestamps can be nearly identical, causing incorrect ordering. The explicit `sequence` field guarantees correct conversation flow preservation.

## Affected Code
- `ChatService.saveUserMessage()`: Now takes sequence parameter
- `ChatService.saveAssistantMessage()`: Now takes sequence parameter 
- `ChatService.saveToolMessage()`: Now takes sequence parameter
- `ChatService.getChatHistory()`: Updated ordering to use sequence first
- `ChatService.processUserMessage()`: Completely rewritten to save messages as they stream