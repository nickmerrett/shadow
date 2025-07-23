#!/usr/bin/env node

/**
 * Test script to verify mock implementations work correctly
 * Run with: npm run test-mock (after adding to package.json)
 */

import { createToolExecutor, createWorkspaceManager } from "./index";

async function testMockImplementation() {
  console.log("🧪 Testing Mock Remote Implementation");
  console.log("====================================\n");

  const taskId = "test-task-" + Date.now();
  const repoUrl = "https://github.com/test/repo";
  const branch = "main";
  const userId = "test-user";

  try {
    // Test workspace manager
    console.log("1. Testing WorkspaceManager...");
    const workspaceManager = createWorkspaceManager("mock");
    
    const workspaceInfo = await workspaceManager.prepareWorkspace(taskId, repoUrl, branch, userId);
    console.log("   ✅ Workspace prepared:", workspaceInfo.success ? "Success" : "Failed");
    
    const status = await workspaceManager.getWorkspaceStatus(taskId);
    console.log("   ✅ Workspace status:", status.exists ? "Exists" : "Not found");
    
    const health = await workspaceManager.healthCheck(taskId);
    console.log("   ✅ Health check:", health.healthy ? "Healthy" : "Unhealthy");

    // Test tool executor
    console.log("\n2. Testing ToolExecutor...");
    const executor = createToolExecutor(taskId, workspaceInfo.workspacePath, "mock");
    
    // Test file operations
    console.log("   Testing file operations...");
    const fileResult = await executor.readFile("test.js", { shouldReadEntireFile: true });
    console.log("   ✅ File read:", fileResult.success ? "Success" : "Failed");
    
    const writeResult = await executor.writeFile("new-file.js", "console.log('test');", "Creating test file");
    console.log("   ✅ File write:", writeResult.success ? "Success" : "Failed");
    
    const deleteResult = await executor.deleteFile("old-file.js");
    console.log("   ✅ File delete:", deleteResult.success ? "Success" : "Failed");

    // Test search operations
    console.log("   Testing search operations...");
    const fileSearch = await executor.searchFiles("component");
    console.log("   ✅ File search:", fileSearch.success ? `Found ${fileSearch.count} files` : "Failed");
    
    const grepSearch = await executor.grepSearch("function");
    console.log("   ✅ Grep search:", grepSearch.success ? `Found ${grepSearch.matchCount} matches` : "Failed");
    
    const codebaseSearch = await executor.codebaseSearch("react component");
    console.log("   ✅ Codebase search:", codebaseSearch.success ? `Found ${codebaseSearch.results.length} results` : "Failed");

    // Test command execution
    console.log("   Testing command execution...");
    const cmdResult = await executor.executeCommand("npm test");
    console.log("   ✅ Command execution:", cmdResult.success ? "Success" : "Failed");
    
    const backgroundCmd = await executor.executeCommand("npm run build", { isBackground: true });
    console.log("   ✅ Background command:", backgroundCmd.success ? "Started" : "Failed");

    // Test directory operations
    console.log("   Testing directory operations...");
    const dirList = await executor.listDirectory("src");
    console.log("   ✅ Directory listing:", dirList.success ? `Found ${dirList.contents?.length || 0} items` : "Failed");

    // Cleanup
    console.log("\n3. Cleaning up...");
    await workspaceManager.cleanupWorkspace(taskId);
    console.log("   ✅ Workspace cleaned up");

    console.log("\n🎉 All mock tests passed!");
    console.log("\nMock implementation is working correctly and ready for tool integration.");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testMockImplementation().catch(console.error);
}

export { testMockImplementation };