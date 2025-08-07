# Plan: Fix Gitignore Discrepancy in File Streaming

## Problem Analysis

**Current Issue:** Streaming mode shows gitignored files while fetch mode doesn't, creating inconsistent behavior.

### Current Behavior:

**1. Streaming (Real-time) Mode:**
- Uses filesystem watchers (`FileSystemWatcher` and `LocalFileSystemWatcher`)
- Has **hardcoded ignore patterns** that are **NOT** gitignore-aware:
  ```typescript
  // Sidecar watcher patterns:
  /node_modules/, /\.git/, /\.DS_Store/, /\.nyc_output/, /coverage/, 
  /dist/, /build/, /tmp/, /\.log$/, /\.tmp$/, /~$/, /\.swp$/, /\.swo$/
  
  // Local watcher patterns:
  /^\.git\//, /^node_modules\//, /^\.vscode\//, /^\.cursor\//, 
  /\.DS_Store$/, /\.tmp$/, /\.log$/, /~$/, /^\./ (all root-level hidden files)
  ```
- **Includes gitignored files** that aren't in these hardcoded patterns
- Shows changes to files like `.env`, `*.pyc`, `*.o`, etc. if they're not explicitly in the hardcoded list

**2. Fetch/Git Mode (when not streaming):**
- Uses `git status --porcelain` command in `/apps/server/src/utils/git-operations.ts:120`
- Git **automatically respects .gitignore rules**
- Only shows files that git actually tracks or would track
- **Excludes all gitignored files** by design

### Why This Discrepancy Exists:

1. **Performance:** Filesystem watchers run in real-time and checking gitignore for every file change would be expensive
2. **Simplicity:** Hardcoded patterns are faster than parsing gitignore files
3. **Oversight:** The streaming implementation was likely built with common ignore patterns without considering project-specific gitignore rules

## Solution Options Considered

### Option 1: Simple Gitignore Integration (Most Simple) ✅
- **Approach:** Parse `.gitignore` once on watcher startup, compile to regex patterns
- **Implementation:** Add gitignore rules to existing hardcoded patterns
- **Pros:** Minimal performance impact, simple to implement
- **Cons:** Won't update if gitignore changes during runtime, no nested gitignore support

### Option 2: Git Check Integration
- **Approach:** For each file change, run `git check-ignore <path>` to determine if ignored
- **Implementation:** Add async check before emitting fs-change events
- **Pros:** 100% accurate, respects all git ignore rules including nested gitignores
- **Cons:** Performance impact (subprocess for each file), could slow down rapid changes

### Option 3: Gitignore Library Integration
- **Approach:** Use a gitignore parsing library (like `ignore` npm package)
- **Implementation:** Parse gitignore files into an ignore checker, cache and reuse
- **Pros:** Good performance, supports complex patterns, no subprocesses
- **Cons:** Additional dependency, need to handle gitignore file updates

### Option 4: Pre-filter with Git Status
- **Approach:** Periodically run `git status --porcelain` and only emit changes for tracked files
- **Implementation:** Background job that updates "trackable files" list every few seconds
- **Pros:** Leverages existing git logic, consistent with fetch mode
- **Cons:** Delay in detecting new files, more complex state management

## Recommended Solution: Option 1

### Implementation Plan

#### Changes Required:

1. **Add gitignore parser utility** (`/apps/server/src/utils/gitignore-parser.ts`)
   - Parse `.gitignore` file into regex patterns
   - Combine with existing hardcoded patterns
   - Export unified ignore checker function

2. **Update LocalFileSystemWatcher** (`/apps/server/src/services/local-filesystem-watcher.ts`)
   - Parse gitignore on watcher startup
   - Integrate gitignore patterns into `shouldIgnoreFile()` method

3. **Update Sidecar FileSystemWatcher** (`/apps/sidecar/src/services/filesystem-watcher.ts`)  
   - Parse gitignore on watcher startup
   - Integrate gitignore patterns into `shouldIgnoreFile()` method

4. **Add gitignore types** (`/packages/types/src/index.ts`)
   - Define interfaces for gitignore pattern handling

### Benefits:
- ✅ Consistent behavior between streaming and fetch modes
- ✅ Minimal performance impact (parse once on startup)
- ✅ No new dependencies required
- ✅ Simple implementation with existing patterns
- ✅ Handles 90% of common gitignore use cases

### Trade-offs:
- Won't detect gitignore changes during runtime (acceptable for most cases)
- Doesn't handle nested gitignores (most projects only use root-level)

## Expected Outcome

After implementation, streaming mode will respect `.gitignore` rules just like fetch mode, providing consistent file change visibility across both modes while maintaining the performance characteristics of the current real-time implementation.