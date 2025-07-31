# Firecracker → Remote Mode Migration

**Migration Approach**: Discovery-based, conservative, phase-by-phase analysis and implementation.

**Core Principle**: Assume nothing, validate everything. Deep exploration before making changes.

---

## 🚨 Current Issue

**Problem**: Pod creation failing with "failed to create containerd task: failed to create shim task: No such file or directory"

**Root Cause**: Pod specification in `firecracker-vm-runner.ts` tries to manually manage Firecracker VMs inside kata-qemu containers, but Kata QEMU handles VM lifecycle automatically. This manual approach conflicts with Kata's architecture.

---

## Phase 1: Emergency Fix (Fix Pod Creation Failure)

**Goal**: Make kata-qemu pods actually start and sidecar become ready

**Status**: 🔴 Not Started

### Discovery Questions
- [ ] What does a working kata-qemu pod spec look like vs our current manual VM management?
- [ ] Which parts of current pod spec are kata-qemu compatible vs conflicting?
- [ ] What does kata-qemu provide automatically that we're trying to do manually?
- [ ] Does the sidecar service need to run differently in kata-qemu environment?

### Files to Analyze (Deep Dive Required)
- [ ] `/apps/server/src/execution/firecracker/firecracker-vm-runner.ts` - Lines 70-256 (manual VM setup)
- [ ] `/test-kata-qemu.yaml` vs `/test-kata-fc.yaml` - Compare working vs failing specs
- [ ] Current sidecar service expectations vs kata-qemu environment

### Tasks
- [ ] **EXPLORE**: Study kata-qemu runtime behavior and requirements
- [ ] **EXPLORE**: Analyze difference between manual Firecracker and kata-qemu pod specs
- [ ] **VALIDATE**: Test minimal kata-qemu pod spec works
- [ ] **FIX**: Simplify pod spec to work with kata-qemu
- [ ] **TEST**: Verify pod creates and sidecar becomes ready

### Success Criteria
- [ ] Pod creation succeeds without "No such file or directory" error
- [ ] Sidecar service becomes ready and health check passes
- [ ] Local mode still works (no regression)

### Discovery Notes

**🔍 Key Insights:**
- **Working test pods**: `test-kata-qemu.yaml` shows simple 26-line pod spec vs our 380+ line manual VM management
- **Sidecar analysis**: Express.js API server with NO Firecracker dependencies in main logic - only 5 references in unused vm-console-proxy.ts
- **Architecture clarity**: kata-qemu runtime handles VM creation automatically, manual Firecracker setup conflicts with this

**✅ Solution Implemented:**
- Removed all init containers (200+ lines of manual VM setup) 
- Simplified to single sidecar container running the Express.js API
- Kept kata-qemu runtime class and essential metadata
- Reduced pod spec from 380+ lines to ~80 lines

**📋 Changes Made:**
- Updated `createFirecrackerVMPodSpec()` method in firecracker-vm-runner.ts
- Removed vm-image-loader and vm-starter init containers  
- Removed manual Firecracker installation and configuration
- Single sidecar container with proper environment variables
- Simplified health checks and resource limits
- **FIXED: Kubernetes pod name validation** - Added `.replaceAll('_', '-')` to convert underscores to hyphens in pod names (RFC 1123 compliance)

---

## Phase 2: Execution Layer Analysis

**Goal**: Understand current firecracker execution layer vs what remote/kata actually needs

**Status**: 🟡 Pending Phase 1

### Discovery Questions
- [ ] What's actually firecracker-specific vs generic remote execution in tool executors?
- [ ] Which workspace management features are manual VM vs kata-qemu compatible?
- [ ] What abstractions can remain the same vs need kata-qemu specific changes?
- [ ] Are there hidden dependencies between execution components?

### Files to Analyze (Deep Dive Required)
- [ ] `/apps/server/src/execution/firecracker/firecracker-tool-executor.ts`
- [ ] `/apps/server/src/execution/firecracker/firecracker-workspace-manager.ts`
- [ ] `/apps/server/src/execution/index.ts` - Factory patterns and mode detection
- [ ] `/packages/types/src/tools/execution.ts` - Type definitions

### Tasks
- [ ] **EXPLORE**: Analyze tool executor HTTP calls vs sidecar expectations
- [ ] **EXPLORE**: Study workspace manager VM lifecycle vs kata-qemu lifecycle
- [ ] **VALIDATE**: Ensure factory patterns work with renamed components
- [ ] **REFACTOR**: Update execution components for kata-qemu compatibility
- [ ] **TEST**: Verify tool operations work end-to-end

### Success Criteria
- [ ] All tool operations (read, write, command execution) work with kata-qemu
- [ ] Workspace lifecycle management works with kata-qemu pods
- [ ] Local mode execution still works (no regression)

### Discovery Notes
*Document what we learn during implementation*

---

## Phase 3: Configuration & Infrastructure Audit

**Goal**: Identify what configuration is legacy vs actually needed for kata-qemu

**Status**: 🟡 Pending Phase 2

### Discovery Questions
- [ ] Which configuration options are Firecracker-specific vs generic VM/remote execution?
- [ ] What deployment scripts are obsolete vs need updating for kata-qemu?
- [ ] Which Kubernetes manifests are relevant vs can be removed?
- [ ] What monitoring/logging configuration is still needed?

### Files to Analyze (Deep Dive Required)
- [ ] `/apps/server/src/config/prod.ts` - Extensive Firecracker configuration
- [ ] `/scripts/deploy-firecracker-infrastructure.sh` - Infrastructure deployment
- [ ] `/apps/server/src/execution/k8s/` - Kubernetes manifests
- [ ] `/.github/workflows/build-vm-images.yml` - CI/CD pipeline

### Tasks
- [ ] **EXPLORE**: Audit each config option for kata-qemu relevance
- [ ] **EXPLORE**: Study deployment scripts for actual vs obsolete functionality
- [ ] **VALIDATE**: Test simplified configuration works
- [ ] **CLEAN**: Remove obsolete configuration and infrastructure
- [ ] **UPDATE**: Adapt remaining config for kata-qemu

### Success Criteria
- [ ] Configuration is simplified and kata-qemu focused
- [ ] Deployment scripts work with kata-qemu runtime
- [ ] No unused/obsolete configuration remains
- [ ] Documentation reflects actual setup requirements

### Discovery Notes
*Document what we learn during implementation*

---

## Phase 4: Systematic Renaming (Only After Understanding)

**Goal**: Rename "firecracker" → "remote" consistently across codebase

**Status**: 🟡 Pending Phase 3

### Discovery Questions
- [ ] Which files can be safely renamed vs need logic changes?
- [ ] What imports/dependencies will break with renaming?
- [ ] Which names should be "remote" vs "kata-qemu" vs something else?
- [ ] Are there any naming conflicts with existing "remote" concepts?

### Renaming Strategy
- **AgentMode**: `"firecracker"` → `"remote"`
- **File Names**: `firecracker-*` → `remote-*`
- **Class Names**: `Firecracker*` → `Remote*`
- **Config Options**: `firecracker*` → `remote*` or `vm*`
- **Environment Variables**: `FIRECRACKER_*` → `REMOTE_*` or `VM_*`

### Files to Rename (Only After Analysis)
- [ ] Directory: `/apps/server/src/execution/firecracker/` → `/apps/server/src/execution/remote/`
- [ ] Type definitions in `/packages/types/src/tools/execution.ts`
- [ ] Configuration schemas and validation
- [ ] All imports and references throughout codebase

### Tasks
- [ ] **PLAN**: Create detailed renaming checklist with dependencies
- [ ] **RENAME**: Update type definitions and interfaces
- [ ] **RENAME**: Update execution layer files and classes
- [ ] **RENAME**: Update configuration and environment variables
- [ ] **TEST**: Verify all imports work and no references are broken

### Success Criteria
- [ ] All "firecracker" references renamed to appropriate "remote" terms
- [ ] No broken imports or missing references
- [ ] Both local and remote modes work correctly
- [ ] All tests pass and builds succeed

### Discovery Notes
*Document what we learn during implementation*

---

## Migration Principles

### 🔍 Deep Analysis Before Action
- Read and understand code behavior, don't just pattern match
- Study runtime behavior and dependencies
- Document surprises and wrong assumptions

### 🧪 Incremental Validation
- Test functionality after each change
- Verify local mode keeps working throughout
- Run builds and lints frequently

### 📝 Discovery Documentation
- Update this document with learnings from each phase
- Note dependencies discovered during implementation
- Track what works vs what needs changes

### 🛡️ Conservative Scope
- Only change what we've thoroughly analyzed
- Leave working code alone unless there's clear need
- Prefer minimal changes over comprehensive refactoring

---

## Quick Reference

**Files with 50+ Firecracker References**: 
- See `grep -r "firecracker" .` output for complete list
- Focus on high-impact files first (execution layer, config, pod specs)
- Many references are comments/logs that can be batch updated later

**Test Files**:
- `test-kata-qemu.yaml` - Working kata-qemu example
- `test-kata-fc.yaml` - Current failing spec
- Compare these to understand the difference

**Key Insights**:
- Kata QEMU handles VM lifecycle automatically
- Manual VM management conflicts with kata-qemu
- Many Firecracker configs may be obsolete with kata-qemu
- Sidecar service still needed but may run differently in kata environment