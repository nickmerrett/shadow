# 🔍 Shadow Backend: Production Multi-User Analysis & Fix Plan

## **📊 SYSTEM ARCHITECTURE OVERVIEW**

### **🏗️ Three-Tier Architecture**

**1. Frontend (Next.js + React)**
- **Location**: `apps/frontend/`
- **WebSocket Client**: Socket.IO with task-specific rooms
- **State Management**: React Query with task-scoped keys
- **Real-time Updates**: Stream chunks, terminal output, file changes
- **Status**: ✅ **Already Task-Scoped** - No issues here

**2. Backend Server (Node.js + Express)**
- **Location**: `apps/server/`
- **Main Components**: HTTP API + WebSocket server
- **Stream Management**: Global state causing data corruption
- **Status**: ❌ **Critical Global State Issues**

**3. Sidecar Container (Express + Socket.IO Client)**
- **Location**: `apps/sidecar/`
- **Runtime**: Kata QEMU VM per task
- **Purpose**: Isolated file/command execution
- **Status**: ✅ **Already Task-Scoped** - No issues here

---

## **🔄 COMPLETE DATA FLOW ANALYSIS**

### **User Interaction Flow**
```
Frontend → Backend API → Task Initialization → VM Creation → Sidecar Startup
    ↓         ↓              ↓                    ↓            ↓
WebSocket → ChatService → LLM Integration → Tool Execution → File Operations
    ↓         ↓              ↓                    ↓            ↓
Stream     Message        Tool Calls        Remote API    Filesystem
Chunks  → Persistence  → Real-time      → HTTP Calls  → Events
    ↓         ↓              ↓                    ↓            ↓
Frontend   Database     WebSocket        Sidecar       WebSocket
Updates    Storage      Broadcasting     Response      Events
```

### **Task Lifecycle**
1. **Initialization** (`TaskInitializationEngine`)
   - Local: Clone repo to filesystem
   - Remote: Create Kata QEMU VM + clone repo inside VM
   - Status tracking via WebSocket events

2. **Execution** (`ChatService` + `ToolExecutor`)
   - LLM streaming with tool calls
   - File operations via abstraction layer
   - Real-time terminal output

3. **Cleanup** (`TaskCleanupService`)
   - Archive completed tasks
   - Destroy VMs and clean filesystem

---

## **🔥 CRITICAL ISSUES IDENTIFIED**

### **💥 Issue #1: Global Stream State (SHOWSTOPPER)**

**Problem Location**: `apps/server/src/socket.ts:33-34`
```typescript
let currentStreamChunks: StreamChunk[] = [];
let isStreaming = false;
```

**Impact**:
- ❌ User A's stream corrupts User B's stream recovery
- ❌ Multiple users see each other's partial responses
- ❌ Stream state recovery fails for concurrent tasks
- ❌ Data leakage between tasks

**Affected Components**:
- `startStream()` - Resets global state
- `endStream()` - Modifies global state  
- `emitStreamChunk()` - Appends to global array
- Stream state recovery in frontend
- WebSocket reconnection handling

### **💥 Issue #2: Single ChatService Instance (MANAGEABLE)**

**Problem Location**: `apps/server/src/app.ts:20`
```typescript
export const chatService = new ChatService();
```

**Impact**:
- ✅ Uses task-keyed Maps internally - actually OK
- ✅ No data corruption between tasks
- 💡 Could be optimized with better resource management

### **💥 Issue #3: Terminal ID Counter (MINOR)**

**Problem Location**: `apps/server/src/agent/tools/index.ts:27`
```typescript
let terminalEntryId = 1;
```

**Impact**:
- ⚠️ Terminal entry IDs not unique across tasks
- ⚠️ Could cause frontend confusion (non-critical)

---

## **🏗️ COMPLETE COMPONENT ANALYSIS**

### **✅ COMPONENTS THAT WORK CORRECTLY**

**1. Database Layer (PostgreSQL + Prisma)**
- Task isolation via foreign keys
- Concurrent access handled properly
- Sequence numbers generated correctly per task

**2. WebSocket Room System**
- Clients join `task-${taskId}` rooms
- Events properly scoped to task rooms
- No cross-task contamination

**3. Execution Abstraction Layer**
- Factory pattern creates task-specific executors
- Local/Remote mode abstraction works correctly
- Tool operations properly isolated

**4. Frontend State Management**
- React Query with task-specific keys
- Component state properly scoped
- Stream reconstruction logic correct

**5. Sidecar Architecture**
- Each VM gets its own sidecar instance
- HTTP APIs are stateless and safe
- Filesystem events properly attributed to taskId

**6. Authentication & Authorization**
- GitHub OAuth scoped to users
- API keys managed per user
- No cross-user data leakage

### **❌ COMPONENTS WITH ISSUES**

**1. Stream State Management**
- Global variables shared across all tasks
- No task-based isolation
- Causes data corruption in multi-user scenarios

**2. Terminal Buffer Management**  
- Global counter for entry IDs
- Minor UX issues with non-unique IDs

---

## **🚀 PRODUCTION READINESS ASSESSMENT**

### **Current State: Single User ✅ | Multi-User ❌**

**What Works in Production**:
- ✅ Individual task isolation (workspace, database, auth)
- ✅ VM-level security isolation (Kata QEMU)
- ✅ Horizontal database scaling
- ✅ File operation safety
- ✅ Resource cleanup and lifecycle management

**What Breaks with Multiple Users**:
- ❌ Stream state corruption between concurrent tasks
- ❌ Incorrect stream recovery on reconnection  
- ❌ Partial responses shown to wrong users
- ❌ Data leakage in WebSocket events

**Severity**: **CRITICAL** - Will cause immediate data corruption and user confusion

---

## **🔧 PRODUCTION MULTI-USER FIX PLAN**

### **Phase 1: Fix Critical Stream State Issues** ⚡ (REQUIRED)

#### **Problem Summary**
The server has global stream state variables that cause data corruption when multiple users stream simultaneously. This is a **critical production blocker**.

#### **Core Fix: Task-Scoped Stream State**

**Current (Broken)**:
```typescript
// In socket.ts - SHARED ACROSS ALL TASKS!
let currentStreamChunks: StreamChunk[] = [];
let isStreaming = false;
```

**Solution: Task-Keyed Stream State**:
```typescript
// Task-specific stream state
const taskStreamStates = new Map<string, {
  chunks: StreamChunk[];
  isStreaming: boolean;
}>();
```

#### **Files to Modify**:

1. **`apps/server/src/socket.ts`**
   - Replace global `currentStreamChunks` and `isStreaming` with `Map<taskId, StreamState>`
   - Update `startStream(taskId)`, `endStream(taskId)`, `emitStreamChunk(chunk, taskId)`
   - Fix stream state recovery to be task-specific
   - Update `onStreamState()` handler to use task-specific state

2. **`apps/server/src/agent/tools/index.ts`**
   - Replace global `terminalEntryId` with task-specific counter or UUIDs
   - Update `createAndEmitTerminalEntry()` to use task-scoped IDs

#### **Testing Requirements**:
- ✅ Two users can stream simultaneously without interference  
- ✅ Stream state recovery works correctly per task
- ✅ WebSocket reconnection restores correct task state
- ✅ No data leakage between concurrent tasks

### **Phase 2: Minimal Redis Integration** 🚀 (Optional)

#### **🎯 Goal: Bounded Memory Usage**
Primary objective is preventing memory leaks as task count scales, with horizontal scaling as a bonus benefit.

#### **🔄 What to Move to Redis (Priority Order)**

**1. Task Stream States** (Highest Impact)
```typescript
// Current: In-memory Map that grows indefinitely
const taskStreamStates = new Map<string, TaskStreamState>();

// Redis: Auto-expiring keys  
// Key: `stream:${taskId}`
// TTL: 1 hour (auto-cleanup of completed tasks)
```

**2. Terminal Polling Intervals** (Medium Impact)
```typescript
// Current: NodeJS.Timeout objects stored in memory
const terminalPollingIntervals = new Map<string, NodeJS.Timeout>();

// Redis: Simple boolean flags
// Key: `terminal:polling:${taskId}` 
// TTL: 2 hours
```

**3. Connection States** (Lower Impact - only if multi-instance)
```typescript
// Current: Socket connection metadata
const connectionStates = new Map<string, ConnectionState>();

// Redis: Only needed for multiple server instances
// Key: `connection:${socketId}`
// TTL: 30 minutes
```

#### **🚫 What NOT to Move (Keep Simple)**
- **ChatService Maps**: Already have good cleanup, low memory footprint
- **Database connections**: PostgreSQL handles this well  
- **File system watchers**: Local to each instance, needed for performance

#### **🔧 Implementation Steps**

**1. Add Redis Client** (5 minutes)
```bash
npm install redis @types/redis
```

**2. Create Redis Service** (15 minutes)
```typescript
// src/services/redis-service.ts
export class RedisService {
  async setTaskStreamState(taskId: string, state: TaskStreamState): Promise<void>
  async getTaskStreamState(taskId: string): Promise<TaskStreamState | null> 
  async deleteTaskStreamState(taskId: string): Promise<void>
  
  async setTerminalPolling(taskId: string, isPolling: boolean): Promise<void>
  async isTerminalPolling(taskId: string): Promise<boolean>
  async deleteTerminalPolling(taskId: string): Promise<void>
}
```

**3. Update Socket.ts** (30 minutes)
```typescript
// Replace Map operations with Redis calls
// Keep same function signatures for compatibility
async function getOrCreateTaskStreamState(taskId: string): Promise<TaskStreamState> {
  return await redisService.getTaskStreamState(taskId) || { chunks: [], isStreaming: false };
}
```

**4. Update Memory Cleanup** (10 minutes)
```typescript  
// Add Redis cleanup to existing MemoryCleanupService
static async cleanupTaskMemory(taskId: string): Promise<void> {
  // ... existing cleanup ...
  await redisService.deleteTaskStreamState(taskId);
  await redisService.deleteTerminalPolling(taskId);
}
```

**5. Add Graceful Fallback** (15 minutes)
```typescript
// Graceful degradation if Redis unavailable
if (!redisService.connected) {
  // Fall back to in-memory Maps (current behavior)
  return memoryFallback.getTaskStreamState(taskId);
}
```

#### **📦 Redis Configuration**

**Key Strategy**:
```
stream:{taskId}                    TTL: 1 hour
terminal:polling:{taskId}          TTL: 2 hours  
connection:{socketId}              TTL: 30 minutes (optional)
```

**Environment Configuration**:
```typescript
// config/shared.ts
export const redis = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  enabled: process.env.REDIS_ENABLED === 'true' || process.env.NODE_ENV === 'production'
};
```

**Docker Compose Addition**:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

#### **📈 Benefits**

**Memory Management**:
- ✅ Stream states auto-expire (no memory leaks)
- ✅ Dead task cleanup happens automatically via TTL
- ✅ Memory usage stays bounded even with thousands of tasks

**Horizontal Scaling** (Bonus):
- ✅ Multiple server instances share stream state
- ✅ WebSocket reconnection works across instances  
- ✅ Load balancer can route requests freely

**Operational**:
- ✅ Redis provides built-in monitoring and inspection
- ✅ Can flush all task data externally if needed
- ✅ Development works without Redis (fallback to in-memory)

#### **🏗️ Additional Enhancements** (Future)

**Performance Optimizations**:
- Add per-user concurrent task limits
- Implement task queueing for resource management
- Add connection pooling and rate limiting
- Database query optimizations for high-concurrency scenarios

**Monitoring & Observability**:
- Add task-level metrics and monitoring
- Stream state health checks  
- Connection pool monitoring
- Resource usage tracking per task

---

## **📋 IMPLEMENTATION PRIORITY**

**🔴 CRITICAL (Phase 1)**: 
- Must be implemented before production deployment
- Estimated effort: 4-6 hours
- **Complexity**: Low-Medium (straightforward refactoring)

**🟡 OPTIONAL (Phase 2)**:
- Can be added incrementally after production deployment
- **Minimal Redis integration**: 2-3 hours
- **Additional enhancements**: +1-2 days each

---

## **🎯 POST-FIX ARCHITECTURE**

After Phase 1 implementation:
- ✅ **Task Isolation**: Complete task scoping across all components
- ✅ **Multi-User Safe**: Multiple users can work simultaneously 
- ✅ **Production Ready**: Single-instance deployment ready
- ✅ **Horizontally Scalable**: With Phase 2 Redis integration

---

## **⚠️ RISK ASSESSMENT**

- **Low Risk**: Changes are isolated to stream state management
- **No Breaking Changes**: Existing task isolation remains intact
- **Backward Compatible**: No API or database changes required
- **Easy Rollback**: Simple revert if issues occur

---

## **🔄 KEY INTERACTIONS BETWEEN COMPONENTS**

### **Server ↔ Frontend Communication**
```
Frontend Socket.IO Client
    ↓ (join task room)
Backend WebSocket Server 
    ↓ (task-scoped events)
Stream State Management (✅ FIXED)
    ↓ (broadcast to room)
Frontend State Updates
```

### **Server ↔ Sidecar Communication**
```
Backend Tool Executor
    ↓ (HTTP API calls)
Sidecar HTTP Server
    ↓ (file operations)
Sidecar Socket.IO Client
    ↓ (filesystem events)
Backend WebSocket Handler
    ↓ (emit to task room)
Frontend Real-time Updates
```

### **Stream Processing Flow**
```
LLM Provider (Anthropic/OpenAI)
    ↓ (streaming tokens)
Stream Processor
    ↓ (structured chunks)
Stream State Manager (✅ FIXED)
    ↓ (task-scoped storage)
WebSocket Broadcaster
    ↓ (room-specific emit)
Frontend Stream Reconstruction
```

---

## **✅ CONCLUSION & STATUS**

### **Phase 1: ✅ COMPLETE (2024)**
All critical multi-user concurrency issues have been **successfully resolved**:

- ✅ **Global stream state fixed**: Replaced with task-scoped Maps
- ✅ **Stream function signatures updated**: Added taskId parameters  
- ✅ **Terminal ID counter fixed**: Now task-unique
- ✅ **Memory cleanup service created**: Comprehensive cleanup system
- ✅ **Cleanup integration**: Integrated with existing task lifecycle

### **Current Production Status: READY** 🚀
The system is now **fully production-ready** for multiple concurrent users with proper task isolation and memory management.

### **Phase 2: Optional Future Enhancement**
Minimal Redis integration documented above can be implemented when scaling needs require bounded memory usage and horizontal scaling capabilities.