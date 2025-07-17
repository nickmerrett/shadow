# Tool Components Scaffolding

This directory contains a comprehensive frontend scaffolding system for mapping backend tool calls to UI components, keeping the frontend and backend in sync.

## Architecture

### 1. Main Tool Registry (`index.tsx`)
- **Central registry** mapping tool names to components
- **Unified status handling** with consistent loading/success/error states
- **Automatic tool routing** based on tool metadata
- **Error boundaries** for unknown tools

### 2. Individual Tool Components

Each tool has its own specialized component with:
- **Tool-specific UI** tailored to the tool's purpose
- **Argument display** showing relevant parameters
- **Result presentation** with appropriate formatting
- **Status indicators** and error handling
- **Consistent styling** matching the app's design

## Supported Tools

| Tool | Component | Features |
|------|-----------|----------|
| `run_terminal_cmd` | RunTerminalCmdTool | Command display + readonly terminal output |
| `read_file` | ReadFileTool | File path, line ranges, content preview |
| `edit_file` | EditFileTool | File path, change stats (+/-), instructions |
| `codebase_search` | CodebaseSearchTool | Query, target directories, search results |
| `grep_search` | GrepSearchTool | Regex pattern, file filters, matches |
| `search_replace` | SearchReplaceTool | File path, before/after diff |
| `list_dir` | ListDirTool | Directory path, contents listing |
| `file_search` | FileSearchTool | Search query, found files |
| `delete_file` | DeleteFileTool | File path being deleted |
| `reapply` | ReapplyTool | File being reapplied with smarter model |

## Key Features

### 1. Terminal Command Tool
- **Command display** in a bordered code block
- **Readonly terminal** with syntax highlighting
- **Auto-scrolling** output
- **Background process** indicator
- **Error highlighting** for failed commands
- **Status badges** (Running/Success/Error)

### 2. File Operation Tools
- **File path highlighting** with monospace font
- **Change statistics** (+N/-N lines)
- **Content previews** with truncation
- **Diff visualization** for replacements

### 3. Search Tools
- **Query highlighting** and formatting
- **Filter indicators** (include/exclude patterns)
- **Directory targeting** display
- **Results preview** with scrollable content

### 4. Consistent Design
- **Color-coded icons** for each tool type
- **Status indicators** (loading spinner, checkmark, error X)
- **Responsive layout** with proper text truncation
- **Dark mode support** for all components
- **Hover effects** and focus states

## Usage

The system automatically maps tool messages to components:

```tsx
import { ToolMessage } from "@/components/chat/tools";

// Automatically renders the appropriate tool component
<ToolMessage message={toolMessage} />
```

## Adding New Tools

1. Create a new component in this directory
2. Add it to the `TOOL_COMPONENTS` registry in `index.tsx`
3. Export it from the main index file
4. The tool will automatically be supported

## Styling Consistency

All components follow the established design patterns:
- `text-muted-foreground` for secondary text
- `font-mono` for code/file paths
- `bg-gray-100 dark:bg-gray-800/50` for code blocks
- Color-coded status indicators (blue=running, green=success, red=error)
- Consistent spacing and typography

## Backend Sync

The components are designed to handle the exact tool metadata structure from the backend:
- `args`: Tool arguments/parameters
- `status`: "running" | "success" | "error"
- `result`: Tool output/results
- `error`: Error messages
- `changes`: File modification metadata