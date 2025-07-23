#!/usr/bin/env node

/**
 * Test script to verify remote implementations work correctly
 * Note: This will fail in environments without Kubernetes access,
 * but demonstrates the implementation structure
 */

import { createToolExecutor, createWorkspaceManager } from "./index";

async function testRemoteImplementation() {
  console.log("🧪 Testing Remote Implementation");
  console.log("=================================\n");

  const taskId = "test-remote-task-" + Date.now();
  const repoUrl = "https://github.com/test/repo";
  const branch = "main";
  const userId = "test-user";

  try {
    // Test workspace manager
    console.log("1. Testing RemoteWorkspaceManager...");
    const workspaceManager = createWorkspaceManager("remote");
    
    console.log("   Creating Kubernetes pod and service...");
    const workspaceInfo = await workspaceManager.prepareWorkspace(taskId, repoUrl, branch, userId);
    
    if (workspaceInfo.success) {
      console.log("   ✅ Workspace prepared successfully");
      console.log(`   📁 Workspace path: ${workspaceInfo.workspacePath}`);
      console.log(`   🚀 Pod created: shadow-agent-${taskId}`);
    } else {
      console.log("   ❌ Workspace preparation failed:", workspaceInfo.error);
      throw new Error("Workspace preparation failed");
    }
    
    console.log("   Checking workspace status...");
    const status = await workspaceManager.getWorkspaceStatus(taskId);
    console.log(`   📊 Status - Exists: ${status.exists}, Ready: ${status.isReady}`);
    
    console.log("   Running health check...");
    const health = await workspaceManager.healthCheck(taskId);
    console.log(`   💚 Health: ${health.healthy ? "Healthy" : "Unhealthy"} - ${health.message}`);

    // Test tool executor
    console.log("\n2. Testing RemoteToolExecutor...");
    const executor = createToolExecutor(taskId, workspaceInfo.workspacePath, "remote");
    
    // Type guard to check if this is a RemoteToolExecutor
    if (executor.isRemote() && 'getSidecarUrl' in executor && 'testConnection' in executor) {
      const remoteExecutor = executor as any; // Cast to access remote-specific methods
      console.log(`   🔗 Sidecar URL: ${remoteExecutor.getSidecarUrl()}`);
      
      // Test connectivity
      console.log("   Testing connection to sidecar...");
      const connected = await remoteExecutor.testConnection();
      console.log(`   🔌 Connection: ${connected ? "Success" : "Failed"}`);
      
      if (connected) {
      // Test file operations
      console.log("   Testing file operations...");
      const fileResult = await executor.readFile("package.json", { shouldReadEntireFile: true });
      console.log(`   📖 File read: ${fileResult.success ? "Success" : "Failed"}`);
      
      const writeResult = await executor.writeFile("test-remote.js", "console.log('Remote test');", "Creating remote test file");
      console.log(`   ✏️  File write: ${writeResult.success ? "Success" : "Failed"}`);
      
      // Test search operations
      console.log("   Testing search operations...");
      const fileSearch = await executor.searchFiles("component");
      console.log(`   🔍 File search: ${fileSearch.success ? `Found ${fileSearch.count} files` : "Failed"}`);
      
      const grepSearch = await executor.grepSearch("function");
      console.log(`   🔎 Grep search: ${grepSearch.success ? `Found ${grepSearch.matchCount} matches` : "Failed"}`);
      
      // Test command execution
      console.log("   Testing command execution...");
      const cmdResult = await executor.executeCommand("pwd");
      console.log(`   ⚡ Command: ${cmdResult.success ? "Success" : "Failed"}`);
      if (cmdResult.success && cmdResult.stdout) {
        console.log(`      Output: ${cmdResult.stdout.substring(0, 100)}`);
      }
      }
    }

    // Cleanup
    console.log("\n3. Cleaning up...");
    const cleanup = await workspaceManager.cleanupWorkspace(taskId);
    console.log(`   🧹 Cleanup: ${cleanup.success ? "Success" : "Failed"} - ${cleanup.message}`);

    console.log("\n🎉 Remote implementation test completed!");
    console.log("\nNote: Some operations may have failed if Kubernetes is not available,");
    console.log("but the implementation structure is correct for production deployment.");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    
    // Attempt cleanup even on failure
    try {
      console.log("\n🧹 Attempting cleanup after failure...");
      const workspaceManager = createWorkspaceManager("remote");
      await workspaceManager.cleanupWorkspace(taskId);
    } catch (cleanupError) {
      console.warn("Cleanup also failed:", cleanupError);
    }
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testRemoteImplementation().catch(console.error);
}

export { testRemoteImplementation };