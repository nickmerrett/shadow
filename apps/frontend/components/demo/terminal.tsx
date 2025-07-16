"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

export const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      theme: {
        background: "#1e1e1e",
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
    });

    // Create fit addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Open terminal
    xterm.open(terminalRef.current);
    fitAddon.fit();

    // Store references
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Write initial prompt
    xterm.writeln("Welcome to Shadow Terminal");
    xterm.writeln("Connecting to backend...");
    xterm.write("\r\n$ ");

    // Handle terminal input
    xterm.onData((data) => {
      // TODO: Send data to backend via websocket
      handleTerminalInput(data);
    });

    // Handle terminal resize
    const handleResize = () => {
      fitAddon.fit();
      // TODO: Send resize event to backend
      handleTerminalResize(xterm.cols, xterm.rows);
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

  // Mock websocket functions (to be implemented when backend is ready)
  const handleTerminalInput = (data: string) => {
    if (!xtermRef.current) return;

    // Echo input for now (remove when backend is connected)
    const xterm = xtermRef.current;
    
    // Handle special characters
    if (data === "\r" || data === "\n") {
      xterm.write("\r\n$ ");
    } else if (data === "\u007f") {
      // Backspace
      xterm.write("\b \b");
    } else if (data === "\u0003") {
      // Ctrl+C
      xterm.write("^C\r\n$ ");
    } else {
      // Regular character
      xterm.write(data);
    }

    // TODO: Send to backend websocket
    console.log("Terminal input:", JSON.stringify(data));
  };

  const handleTerminalResize = (cols: number, rows: number) => {
    // TODO: Send resize event to backend websocket
    console.log("Terminal resize:", { cols, rows });
  };

  const connectWebSocket = () => {
    // TODO: Implement websocket connection to backend
    // const ws = new WebSocket('ws://localhost:8080/terminal');
    // 
    // ws.onopen = () => {
    //   setIsConnected(true);
    //   if (xtermRef.current) {
    //     xtermRef.current.clear();
    //     xtermRef.current.writeln('Connected to backend terminal');
    //     xtermRef.current.write('$ ');
    //   }
    // };
    //
    // ws.onmessage = (event) => {
    //   if (xtermRef.current) {
    //     xtermRef.current.write(event.data);
    //   }
    // };
    //
    // ws.onclose = () => {
    //   setIsConnected(false);
    //   if (xtermRef.current) {
    //     xtermRef.current.writeln('\r\nConnection lost. Reconnecting...');
    //   }
    // };
    //
    // ws.onerror = (error) => {
    //   console.error('WebSocket error:', error);
    //   setIsConnected(false);
    // };

    console.log("WebSocket connection would be established here");
  };

  const disconnectWebSocket = () => {
    // TODO: Close websocket connection
    setIsConnected(false);
    console.log("WebSocket connection would be closed here");
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <div className="p-3 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-300">Terminal</h2>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <button
            onClick={isConnected ? disconnectWebSocket : connectWebSocket}
            className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>
      <div className="flex-1 p-2">
        <div
          ref={terminalRef}
          className="h-full w-full rounded"
          style={{ minHeight: "400px" }}
        />
      </div>
    </div>
  );
};