"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useParams } from "next/navigation";

interface TerminalEntry {
  id: number;
  timestamp: number;
  data: string;
  type: 'stdout' | 'stderr' | 'command' | 'system';
  processId?: number;
}

export default function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const socket = useSocket();
  const params = useParams();
  const taskId = params?.taskId as string;

  // Terminal entry formatting with ANSI colors
  const writeToTerminal = (entry: TerminalEntry) => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    switch (entry.type) {
      case 'command':
        // Green bold for commands
        xterm.write(`\x1b[1;32m$ ${entry.data}\x1b[0m\r\n`);
        break;
      case 'stdout':
        // Normal white text for stdout
        xterm.write(entry.data);
        break;
      case 'stderr':
        // Red text for errors  
        xterm.write(`\x1b[31m${entry.data}\x1b[0m`);
        break;
      case 'system':
        // Gray text for system messages
        xterm.write(`\x1b[90m${entry.data}\x1b[0m\r\n`);
        break;
      default:
        xterm.write(entry.data);
    }
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      theme: {
        background: "#151515",
        foreground: "#d4d4d4",
        cursor: "#ffffff",
        cursorAccent: "#000000",
        selectionBackground: "#3a3d41",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
      allowProposedApi: true,
      disableStdin: true, // Read-only terminal
    });

    // Create fit addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Open terminal
    xterm.open(terminalRef.current);

    // Store references
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Write initial welcome message
    xterm.writeln("Shadow Agent Terminal");
    xterm.writeln("Waiting for agent commands...");
    xterm.writeln("");

    // Handle terminal resize
    const handleResize = () => {
      fitAddon.fit();
    };

    // Resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Initial resize
    setTimeout(handleResize, 100);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
    };
  }, []);

  // Socket.IO terminal integration
  useEffect(() => {
    if (!socket || !taskId) return;

    console.log("[TERMINAL] Setting up Socket.IO listeners for task:", taskId);

    // Request terminal history when component mounts
    socket.emit("get-terminal-history", { taskId });

    // Handle terminal history
    const handleTerminalHistory = (data: { taskId: string; entries: TerminalEntry[] }) => {
      if (data.taskId !== taskId) return;
      
      console.log("[TERMINAL] Received terminal history:", data.entries.length, "entries");
      
      // Clear terminal and show history
      if (xtermRef.current) {
        xtermRef.current.clear();
        data.entries.forEach(entry => writeToTerminal(entry));
      }
    };

    // Handle real-time terminal output
    const handleTerminalOutput = (data: { taskId: string; entry: TerminalEntry }) => {
      if (data.taskId !== taskId) return;
      
      console.log("[TERMINAL] Received terminal output:", data.entry);
      writeToTerminal(data.entry);
    };

    // Handle terminal cleared
    const handleTerminalCleared = (data: { taskId: string }) => {
      if (data.taskId !== taskId) return;
      
      console.log("[TERMINAL] Terminal cleared");
      if (xtermRef.current) {
        xtermRef.current.clear();
        xtermRef.current.writeln("Terminal cleared");
        xtermRef.current.writeln("");
      }
    };

    // Handle connection status
    const handleConnect = () => {
      console.log("[TERMINAL] Socket connected");
      setIsConnected(true);
      // Re-request terminal history on reconnect
      socket.emit("get-terminal-history", { taskId });
    };

    const handleDisconnect = () => {
      console.log("[TERMINAL] Socket disconnected");
      setIsConnected(false);
    };

    // Register event listeners
    socket.on("terminal-history", handleTerminalHistory);
    socket.on("terminal-output", handleTerminalOutput); 
    socket.on("terminal-cleared", handleTerminalCleared);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // Handle errors
    socket.on("terminal-history-error", (data: { error: string }) => {
      console.error("[TERMINAL] History error:", data.error);
      if (xtermRef.current) {
        xtermRef.current.writeln(`\x1b[31mError loading terminal history: ${data.error}\x1b[0m`);
      }
    });

    socket.on("terminal-error", (data: { error: string }) => {
      console.error("[TERMINAL] Terminal error:", data.error);
      if (xtermRef.current) {
        xtermRef.current.writeln(`\x1b[31mTerminal error: ${data.error}\x1b[0m`);
      }
    });

    // Set initial connection status
    setIsConnected(socket.connected);

    // Cleanup
    return () => {
      socket.off("terminal-history", handleTerminalHistory);
      socket.off("terminal-output", handleTerminalOutput);
      socket.off("terminal-cleared", handleTerminalCleared);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("terminal-history-error");
      socket.off("terminal-error");
    };
  }, [socket, taskId]);

  return (
    <div className="bg-background flex-1 overflow-hidden p-2 relative">
      {/* Connection status indicator */}
      <div className="absolute top-4 right-4 z-10">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
             title={isConnected ? 'Connected' : 'Disconnected'} />
      </div>
      
      <div ref={terminalRef} className="h-full" />
    </div>
  );
}
