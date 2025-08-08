# Complete Checkpointing Implementation Plan

## Overview
Implement message-level checkpointing to enable time-travel editing by storing git commit SHA and todo snapshots in ChatMessage metadata, allowing users to edit past messages and restore exact system state.

## Phase 1: Core Checkpointing Infrastructure

### 1. Enhance Message Metadata Types (`packages/types/src/messages.ts`)
```typescript
interface CheckpointData {
  commitSha: string;
  todoSnapshot: Todo[];
  createdAt: string;
  workspaceState: 'clean' | 'dirty';
}

// Add to existing MessageMetadata
interface MessageMetadata {
  // ... existing fields
  checkpoint?: CheckpointData;
}
```

### 2. Extend GitManager (`apps/server/src/services/git-manager.ts`)
Add new methods:
- `stashChanges()` - create timestamped stash for uncommitted work
- `checkoutCommit(sha)` - safely checkout to specific commit
- `safeCheckoutCommit(sha)` - with error handling and fallbacks

### 3. Create CheckpointService (`apps/server/src/services/checkpoint-service.ts`)
New service to handle:
- `createCheckpoint(taskId, messageId)` - capture current state
- `restoreCheckpoint(taskId, messageId)` - restore to specific message
- `getTodoSnapshot(taskId)` - serialize current todo state
- `restoreTodoState(taskId, snapshot)` - recreate todos from snapshot

### 4. Modify ChatService (`apps/server/src/agent/chat.ts`)

#### A. Enhanced Checkpoint Creation
Modify `_processUserMessageInternal()` after successful completion:
```typescript
// After line 1207 (after createPRIfUserEnabled)
if (assistantMessageId) {
  await this.checkpointService.createCheckpoint(taskId, assistantMessageId);
}
```

#### B. Enhanced Message Editing
Modify `editUserMessage()` to restore state before deletion:
```typescript
// Before deleting subsequent messages (line 1403)
await this.checkpointService.restoreCheckpoint(taskId, messageId);

// Then continue with existing deletion logic
await prisma.chatMessage.deleteMany({...});
```

## Phase 2: Implementation Details

### 1. Checkpoint Creation Flow
```typescript
async createCheckpoint(taskId: string, messageId: string) {
  try {
    // 1. Ensure all changes are committed (reuse existing logic)
    const hasChanges = await gitManager.hasChanges();
    if (hasChanges) {
      console.warn("Creating checkpoint with uncommitted changes");
      return; // Skip checkpoint if workspace is dirty
    }

    // 2. Capture current state
    const commitSha = await gitManager.getCurrentCommitSha();
    const todoSnapshot = await getTodoSnapshot(taskId);

    // 3. Store in message metadata
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        metadata: {
          ...(existing metadata),
          checkpoint: {
            commitSha,
            todoSnapshot,
            createdAt: new Date().toISOString(),
            workspaceState: 'clean'
          }
        }
      }
    });

    console.log(`[CHECKPOINT] Created for message ${messageId} at commit ${commitSha}`);
  } catch (error) {
    console.error("Failed to create checkpoint:", error);
    // Non-blocking - don't fail the chat flow
  }
}
```

### 2. Checkpoint Restoration Flow
```typescript
async restoreCheckpoint(taskId: string, targetMessageId: string) {
  try {
    // 1. Find the most recent assistant message before/at target
    const checkpointMessage = await this.findCheckpointMessage(taskId, targetMessageId);
    if (!checkpointMessage?.metadata?.checkpoint) {
      console.warn("No checkpoint found for restoration");
      return;
    }

    const checkpoint = checkpointMessage.metadata.checkpoint;

    // 2. Handle uncommitted changes
    const hasChanges = await gitManager.hasChanges();
    if (hasChanges) {
      await gitManager.stashChanges(`Pre-revert-${Date.now()}`);
      console.log("Stashed uncommitted changes before restore");
    }

    // 3. Restore git state
    const success = await gitManager.safeCheckoutCommit(checkpoint.commitSha);
    if (!success) {
      console.warn(`Could not checkout to ${checkpoint.commitSha}, continuing with current state`);
    }

    // 4. Restore todo state
    await this.restoreTodoState(taskId, checkpoint.todoSnapshot);

    console.log(`[CHECKPOINT] Restored to message ${checkpointMessage.id} at commit ${checkpoint.commitSha}`);
  } catch (error) {
    console.error("Failed to restore checkpoint:", error);
    // Continue with edit flow even if restore fails
  }
}
```

### 3. Todo State Management
```typescript
async getTodoSnapshot(taskId: string): Promise<Todo[]> {
  return await prisma.todo.findMany({
    where: { taskId },
    orderBy: { sequence: 'asc' }
  });
}

async restoreTodoState(taskId: string, snapshot: Todo[]) {
  await prisma.$transaction(async (tx) => {
    // Delete current todos
    await tx.todo.deleteMany({ where: { taskId } });
    
    // Recreate from snapshot
    if (snapshot.length > 0) {
      await tx.todo.createMany({
        data: snapshot.map(todo => ({
          id: todo.id,
          content: todo.content,
          status: todo.status,
          sequence: todo.sequence,
          taskId, // Ensure correct task association
          createdAt: todo.createdAt,
          updatedAt: new Date() // Update timestamp
        }))
      });
    }
  });
}
```

### 4. Git Safety Operations
```typescript
// In GitManager
async stashChanges(message: string = `Auto-stash-${Date.now()}`): Promise<void> {
  try {
    await this.execGit(`stash push -m "${message}"`);
    console.log(`[GIT] Stashed changes: ${message}`);
  } catch (error) {
    console.warn("Failed to stash changes:", error);
    // Non-blocking
  }
}

async safeCheckoutCommit(commitSha: string): Promise<boolean> {
  try {
    await this.execGit(`checkout ${commitSha}`);
    return true;
  } catch (error) {
    console.warn(`Cannot checkout to ${commitSha}:`, error);
    return false;
  }
}
```

## Phase 3: User Experience Enhancements

### 1. Frontend Notifications
- Show user when checkpoint restoration occurs
- Indicate when changes were stashed
- Display current commit SHA in UI

### 2. Error Recovery
- Graceful handling of missing commits
- Fallback behavior when restoration fails
- Option to continue without restoration

### 3. Performance Optimizations
- Only create checkpoints after successful commits
- Skip checkpointing for tool-only responses
- Lazy load checkpoint data in UI

## Expected User Flow

1. **Normal Operation**: Each assistant response creates a checkpoint (commit + todo snapshot)
2. **Edit Past Message**: User clicks edit on message #5 of 10
3. **Automatic Restoration**: 
   - Stash any uncommitted changes
   - Checkout to commit from message #5's checkpoint
   - Restore todo list to state after message #5
   - Delete messages #6-10 from database
4. **Continue Processing**: Re-process from edited message #5 with new content
5. **Result**: Workspace is exactly as it was after the original message #5

## Risk Mitigation

- **Non-blocking checkpoints** - failures don't break chat flow
- **Graceful degradation** - continue even if restoration fails  
- **Uncommitted change safety** - always stash before restoration
- **Transaction safety** - atomic todo state updates
- **Logging** - comprehensive logging for debugging

This implementation provides robust time-travel capabilities while maintaining system stability and user experience.

## Implementation Status

### ✅ Phase 1: Core Checkpointing Infrastructure - COMPLETED

#### 1. Enhanced Message Metadata Types
**File**: `packages/types/src/chat/messages.ts`
- ✅ Added `CheckpointData` interface with `{commitSha, todoSnapshot, createdAt, workspaceState}`  
- ✅ Extended existing `MessageMetadata` with optional `checkpoint` field
- ✅ Added `Todo` import from `@repo/db`

#### 2. Extended GitManager 
**File**: `apps/server/src/services/git-manager.ts`
- ✅ Added `stashChanges(message)` - safely preserve uncommitted work before time-travel
- ✅ Added `safeCheckoutCommit(sha)` - jump to specific commit with graceful failure handling
- ✅ Both methods use existing `execGit()` infrastructure with proper error handling

#### 3. Created CheckpointService
**File**: `apps/server/src/services/checkpoint-service.ts` (NEW)
- ✅ `createCheckpoint(taskId, messageId)` - capture commit SHA + todo snapshot after successful responses
- ✅ `restoreCheckpoint(taskId, messageId)` - restore git state + todos before message editing  
- ✅ `getTodoSnapshot()` / `restoreTodoState()` - serialize/restore todo state from database
- ✅ `findCheckpointMessage()` - locate most recent checkpoint at or before target message
- ✅ Export singleton `checkpointService` instance

### ✅ Phase 2: Integration Points - COMPLETED

#### 1. Auto-Checkpoint Creation
**File**: `apps/server/src/agent/chat.ts`
- ✅ Added import for `checkpointService`
- ✅ After successful response completion (line ~1191, after `createPRIfUserEnabled`)
- ✅ Call `checkpointService.createCheckpoint(taskId, assistantMessageId)` when changes are committed
- ✅ Store checkpoint data in message metadata

#### 2. Restore Before Message Editing
**File**: `apps/server/src/agent/chat.ts` 
- ✅ In `editUserMessage()` before deleting subsequent messages (line ~1396)
- ✅ Call `checkpointService.restoreCheckpoint(taskId, messageId)` 
- ✅ Stash uncommitted work, checkout to target commit, restore todos

### 🔄 Phase 3: Testing & Validation - IN PROGRESS

#### Next Steps:
1. **Test checkpoint creation** - Verify checkpoints are created after successful responses
2. **Test checkpoint restoration** - Verify git state and todos are restored during message editing
3. **Test error handling** - Verify graceful degradation when checkpoints fail
4. **Validate git operations** - Ensure stash/checkout operations work correctly
5. **Performance testing** - Monitor impact of checkpoint operations

#### Expected Behavior:
- **Normal Operation**: Each assistant response with file changes creates a checkpoint
- **Edit Past Message**: User editing triggers automatic workspace restoration
- **Clean Timeline**: New responses create clean git history (A→B' instead of A→B→C→D→E→B')

The core checkpointing infrastructure is now complete and integrated into the chat flow!