
- Cline has a plan mode and act mode
- ApiHandler interface gets OpenAI, Anthropic, Cline and OpenRouter APIs
- ToolExecutor uses MCP to execute tools

- Task Management: Creates and manages Task instances via `initTask`, `clearTask`, `cancelTask`
- State Coordination: Synchronizes state between backend and UI with `postStateToWebview` (note this)
- History Management: Maintains task history and favorites via `updateTaskHistory`, `deleteAllTaskHistory`

- Chat History Abstraction is needed

Key file operation tools include:
- read_file supports extracting content, including from PDFs and DOCX
- write_to_file handles full file creation or replacement
- replace_in_file does targeted edits using search/replace blocks
- list_files traverses directories, can do recursion
- search_files finds content across files using regex

- bash_tool is a tool that can execute bash commands
- XML tags are used for tool calls