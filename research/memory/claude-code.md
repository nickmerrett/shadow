## Long Context Management

Claude Code uses **automatic conversation compaction** to handle long conversations and enable effectively infinite conversation length. This system automatically manages conversation length when the context becomes too long.

The compaction system has configurable thresholds - the auto-compact warning threshold was increased from 60% to 80% to give users more context before compaction occurs.

The compaction feature can be toggled on/off through the `/config` command, giving users control over this behavior.

## Memory System Features

Claude Code includes a **memory system** that allows users to quickly add information to memory by starting their message with the '#' prefix. This provides a convenient way to maintain important context across conversations.

The system also has improved todo list handling during compaction, which helps preserve important task information when conversations are compressed.

## Hook System for Context Management

Claude Code provides a **PreCompact hook** that triggers before conversation compaction occurs. This allows developers to implement custom logic for what should be preserved or handled during the compaction process.

## Session Persistence

The system supports conversation persistence with features like:

- **Resume conversations**: Users can continue previous conversations with `claude --continue` and `claude --resume`
- **Conversation switching**: The `/resume` slash command allows switching between different conversation contexts

## Notes

Claude Code does **not implement traditional "Long Term Memory" (LTM)** in the sense of persistent knowledge storage across all sessions. Instead, it uses:

1. **Conversation compaction** - automatically summarizing and reducing context while preserving important information
2. **Memory shortcuts** - the '#' prefix system for quick memory additions within a conversation
3. **Session persistence** - ability to resume and switch between conversations
4. **Hook-based extensibility** - allowing custom memory management through the PreCompact hook

This approach focuses on intelligent context management rather than persistent cross-session memory storage. The system is designed to maintain conversation continuity while working within Claude's context limitations through automatic compression and user-controlled memory features.
