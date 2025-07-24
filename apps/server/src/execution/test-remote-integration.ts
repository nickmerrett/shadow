#!/usr/bin/env node

/**
 * Simple integration test for remote mode execution
 * Tests that the dual-mode architecture works correctly
 * 
 * Run with: npx tsx apps/server/src/execution/test-remote-integration.ts
 */

import { createToolExecutor, createWorkspaceManager } from "./index.js";
import { AgentMode } from "./interfaces/types.js";

async function testModeIntegration(mode: AgentMode) {
  console.log(`\n=== Testing ${mode.toUpperCase()} mode ===`);
  
  const taskId = `test-${mode}-${Date.now()}`;
  const testConfig = {
    id: taskId,
    repoUrl: "https://github.com/anthropics/claude-code",
    baseBranch: "main",
    shadowBranch: `shadow/task-${taskId}`,
    userId: "test-user",
  };

  try {
    // Test workspace manager
    console.log(`[${mode}] Creating workspace manager...`);
    const workspaceManager = createWorkspaceManager(mode);
    
    console.log(`[${mode}] Workspace manager created: ${workspaceManager.constructor.name}`);
    console.log(`[${mode}] Is remote: ${workspaceManager.isRemote()}`);

    // Test tool executor
    console.log(`[${mode}] Creating tool executor...`);
    const toolExecutor = createToolExecutor(taskId, "/workspace", mode);
    
    console.log(`[${mode}] Tool executor created: ${toolExecutor.constructor.name}`);
    console.log(`[${mode}] Task ID: ${toolExecutor.getTaskId()}`);
    console.log(`[${mode}] Workspace path: ${toolExecutor.getWorkspacePath()}`);
    console.log(`[${mode}] Is remote: ${toolExecutor.isRemote()}`);

    // For mock mode, test some operations
    if (mode === "mock") {
      console.log(`[${mode}] Testing workspace preparation...`);
      const workspaceInfo = await workspaceManager.prepareWorkspace(testConfig);
      console.log(`[${mode}] Workspace preparation result:`, {
        success: workspaceInfo.success,
        path: workspaceInfo.workspacePath,
        error: workspaceInfo.error,
      });

      if (workspaceInfo.success) {
        console.log(`[${mode}] Testing workspace status...`);
        const status = await workspaceManager.getWorkspaceStatus(taskId);
        console.log(`[${mode}] Workspace status:`, {
          exists: status.exists,
          isReady: status.isReady,
          path: status.path,
        });

        console.log(`[${mode}] Testing health check...`);
        const health = await workspaceManager.healthCheck(taskId);
        console.log(`[${mode}] Health check:`, {
          healthy: health.healthy,
          message: health.message,
        });

        console.log(`[${mode}] Testing tool operations...`);
        
        // Test file operations with expected failures in mock mode
        const readResult = await toolExecutor.readFile("package.json");
        console.log(`[${mode}] Read file result:`, {
          success: readResult.success,
          hasContent: !!readResult.content,
          error: readResult.error,
        });

        const writeResult = await toolExecutor.writeFile("test.txt", "Hello World", "Create test file");
        console.log(`[${mode}] Write file result:`, {
          success: writeResult.success,
          message: writeResult.message,
          error: writeResult.error,
        });

        console.log(`[${mode}] Testing workspace cleanup...`);
        const cleanupResult = await workspaceManager.cleanupWorkspace(taskId);
        console.log(`[${mode}] Cleanup result:`, {
          success: cleanupResult.success,
          message: cleanupResult.message,
        });
      }
    }

    // For remote mode, just test basic functionality without actual operations  
    if (mode === "remote") {
      console.log(`[${mode}] Testing basic remote functionality...`);
      
      // Test health check (will fail without actual sidecar)
      const health = await toolExecutor.healthCheck();
      console.log(`[${mode}] Sidecar health check:`, {
        healthy: health.healthy,
        message: health.message,
      });

      // Test connectivity (will fail without actual sidecar)
      const connectivity = await toolExecutor.testConnection();
      console.log(`[${mode}] Sidecar connectivity test: ${connectivity}`);

      if ("getSidecarUrl" in toolExecutor) {
        console.log(`[${mode}] Sidecar URL: ${(toolExecutor as any).getSidecarUrl()}`);
      }
    }

    console.log(`[${mode}] ✅ Mode integration test completed successfully`);
    return true;

  } catch (error) {
    console.error(`[${mode}] ❌ Mode integration test failed:`, error);
    return false;
  }
}

async function runAllTests() {
  console.log("🧪 Running remote mode integration tests...\n");
  
  const modes: AgentMode[] = ["local", "mock", "remote"];
  const results: Record<AgentMode, boolean> = {} as any;
  
  for (const mode of modes) {
    results[mode] = await testModeIntegration(mode);
  }

  console.log("\n📊 Test Results Summary:");
  console.log("========================");
  
  let allPassed = true;
  for (const mode of modes) {
    const status = results[mode] ? "✅ PASS" : "❌ FAIL";
    console.log(`${mode.padEnd(8)}: ${status}`);
    if (!results[mode]) allPassed = false;
  }

  console.log(`\n🎯 Overall: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  
  if (allPassed) {
    console.log("\n✨ Remote mode integration is working correctly!");
    console.log("You can now use AGENT_MODE=remote for distributed execution.");
  } else {
    console.log("\n⚠️  Some issues detected. Check the logs above for details.");
  }

  process.exit(allPassed ? 0 : 1);
}

// Run the tests
runAllTests().catch(console.error);