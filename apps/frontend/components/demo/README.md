# Demo Components

This folder contains primitive UI components for the Shadow project demo.

## Monaco Editor (`monaco-editor.tsx`)

A code editor component built with Monaco Editor featuring:

- **File Explorer Sidebar**: Collapsible folder tree with file navigation
- **Read-only Editor**: Monaco editor with syntax highlighting for multiple languages
- **Language Detection**: Automatic language detection based on file extension
- **Dark Theme**: VS Code dark theme with proper styling
- **Mock File Structure**: Sample React/TypeScript project structure for demo

**Features:**
- Click folders to expand/collapse
- Click files to view content in editor
- TypeScript, JavaScript, JSON, Markdown, CSS support
- Responsive layout with fixed sidebar

**Demo Page:** `/demo/monaco`

## Terminal (`terminal.tsx`)

A terminal emulator component built with xterm.js featuring:

- **Interactive Terminal**: Full xterm.js terminal with cursor and input handling
- **Websocket Ready**: Event handlers prepared for backend websocket integration
- **Connection Status**: Visual indicator for connection state
- **Auto-resize**: Terminal automatically resizes to fit container
- **Terminal Themes**: Dark theme with proper colors

**Features:**
- Basic input echo (temporary until backend connection)
- Resize handling with FitAddon
- Connection/disconnection controls (UI only)
- Special character handling (backspace, ctrl+c, enter)
- Terminal prompt simulation

**Demo Page:** `/demo/terminal`

## Demo Pages

- **Monaco Demo**: Visit `/demo/monaco` to see the editor with file explorer
- **Terminal Demo**: Visit `/demo/terminal` to see the interactive terminal

## Dependencies Added

```json
{
  "@monaco-editor/react": "^4.x.x",
  "@xterm/xterm": "^5.x.x", 
  "@xterm/addon-fit": "^0.x.x"
}
```

## Future Integration

These components are designed to be:
1. **Modular**: Easy to integrate into the main app
2. **Configurable**: Props can be added for customization
3. **Backend-ready**: Terminal has websocket event structure prepared
4. **Extensible**: Monaco editor can be made editable and connected to file system

## Notes

- Components are currently standalone and not integrated into main app
- Terminal websocket connection is stubbed with TODO comments
- Monaco editor uses mock file structure
- Both components are fully responsive and mobile-friendly