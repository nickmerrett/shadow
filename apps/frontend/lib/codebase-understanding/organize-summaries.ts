import { CodebaseSummary } from "@repo/types";
import { FileNode } from "@repo/types";

export function transformSummariesToFileTree(summaries: CodebaseSummary[]): {
  fileTree: FileNode[];
  summaryMap: Map<string, CodebaseSummary>;
} {
  const summaryMap = new Map<string, CodebaseSummary>();
  const nodeMap = new Map<string, FileNode>();

  // Filter to only file and directory summaries
  const relevantSummaries = summaries.filter(
    (s) => s.type === "file_summary" || s.type === "directory_summary"
  );

  // Helper to get or create a node at a given path
  const getOrCreateNode = (path: string, isDirectory: boolean): FileNode => {
    if (nodeMap.has(path)) {
      return nodeMap.get(path)!;
    }

    const pathParts = path.split("/").filter(Boolean);
    const name = pathParts[pathParts.length - 1] || path;

    const node: FileNode = {
      path,
      name,
      type: isDirectory ? "folder" : "file",
      ...(isDirectory && { children: [] }),
    };

    nodeMap.set(path, node);
    return node;
  };

  // Helper to ensure all parent directories exist
  const ensureParentDirectories = (filePath: string) => {
    const pathParts = filePath.split("/").filter(Boolean);

    // Create all parent directories
    for (let i = 1; i < pathParts.length; i++) {
      const dirPath = pathParts.slice(0, i).join("/");
      const parentNode = getOrCreateNode(dirPath, true);

      // Link to its parent if it has one
      if (i > 1) {
        const grandParentPath = pathParts.slice(0, i - 1).join("/");
        const grandParentNode = getOrCreateNode(grandParentPath, true);

        if (
          !grandParentNode.children!.some(
            (child) => child.path === parentNode.path
          )
        ) {
          grandParentNode.children!.push(parentNode);
        }
      }
    }
  };

  // Process all summaries
  relevantSummaries.forEach((summary) => {
    const filePath = summary.filePath;
    if (!filePath) return;

    summaryMap.set(filePath, summary);

    // Ensure all parent directories exist
    ensureParentDirectories(filePath);

    // Create the actual file/directory node
    const isDirectory = summary.type === "directory_summary";
    const node = getOrCreateNode(filePath, isDirectory);

    // Link to parent directory
    const pathParts = filePath.split("/").filter(Boolean);
    if (pathParts.length > 1) {
      const parentPath = pathParts.slice(0, -1).join("/");
      const parentNode = getOrCreateNode(parentPath, true);

      if (!parentNode.children!.some((child) => child.path === node.path)) {
        parentNode.children!.push(node);
      }
    }
  });

  // Build the root tree - collect all top-level nodes
  const rootNodes: FileNode[] = [];

  nodeMap.forEach((node, path) => {
    const pathParts = path.split("/").filter(Boolean);

    // This is a top-level node (only one path segment)
    if (pathParts.length === 1) {
      rootNodes.push(node);
    }
  });

  // Sort children recursively
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes
      .sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        // Then alphabetically
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        ...(node.children && { children: sortNodes(node.children) }),
      }));
  };

  return {
    fileTree: sortNodes(rootNodes),
    summaryMap,
  };
}
