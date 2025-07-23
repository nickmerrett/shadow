#!/usr/bin/env tsx

/**
 * Integration test for sidecar service
 * Tests that the sidecar API matches what RemoteToolExecutor expects
 */

// Using Node.js built-in fetch (available in Node 18+)

const SIDECAR_URL = process.env.SIDECAR_URL || "http://localhost:8080";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const tests: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  console.log(`\nRunning test: ${name}`);
  try {
    await fn();
    tests.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    tests.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
    console.log(`❌ ${name}: ${error}`);
  }
}

async function runTests() {
  console.log(`Testing sidecar at: ${SIDECAR_URL}`);

  // Test health endpoint
  await runTest("Health check", async () => {
    const res = await fetch(`${SIDECAR_URL}/health`);
    const data = await res.json();
    if (!data.healthy) throw new Error("Service not healthy");
  });

  // Test workspace status
  await runTest("Workspace status", async () => {
    const res = await fetch(`${SIDECAR_URL}/status`);
    const data = await res.json();
    if (!data.exists || !data.isReady) {
      throw new Error("Workspace not ready");
    }
  });

  // Test file write
  await runTest("Write file", async () => {
    const res = await fetch(`${SIDECAR_URL}/files/test.txt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Hello from integration test!",
        instructions: "Create test file",
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  });

  // Test file read
  await runTest("Read file", async () => {
    const res = await fetch(`${SIDECAR_URL}/files/test.txt`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    if (data.content !== "Hello from integration test!") {
      throw new Error("File content mismatch");
    }
  });

  // Test directory listing
  await runTest("List directory", async () => {
    const res = await fetch(`${SIDECAR_URL}/directory/`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    const testFile = data.contents?.find((f: any) => f.name === "test.txt");
    if (!testFile) throw new Error("Test file not found in directory listing");
  });

  // Test file search
  await runTest("Search files", async () => {
    const res = await fetch(`${SIDECAR_URL}/search/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test" }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    if (data.count === 0) throw new Error("No files found");
  });

  // Test grep search
  await runTest("Grep search", async () => {
    const res = await fetch(`${SIDECAR_URL}/search/grep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Hello",
        caseSensitive: false,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  });

  // Test command execution
  await runTest("Execute command", async () => {
    const res = await fetch(`${SIDECAR_URL}/execute/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "echo 'Test command'",
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    if (!data.stdout?.includes("Test command")) {
      throw new Error("Command output mismatch");
    }
  });

  // Test file deletion
  await runTest("Delete file", async () => {
    const res = await fetch(`${SIDECAR_URL}/files/test.txt`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  });

  // Summary
  console.log("\n=== Test Summary ===");
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;

  console.log(`Total: ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    tests.filter(t => !t.passed).forEach(t => {
      console.log(`- ${t.name}: ${t.error}`);
    });
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
  }
}

// Run tests
runTests().catch(error => {
  console.error("Test runner failed:", error);
  process.exit(1);
});