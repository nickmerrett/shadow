"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";

export default function Terminal() {
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

    // Write initial content
    xterm.writeln("Welcome to Shadow Agent Environment");
    xterm.writeln("Terminal is read-only in demo mode");
    xterm.writeln("");
    xterm.writeln("$ git status");
    xterm.writeln("On branch main");
    xterm.writeln("Your branch is up to date with 'origin/main'.");
    xterm.writeln("");
    xterm.writeln("nothing to commit, working tree clean");
    xterm.writeln("");
    xterm.writeln("$ npm run test");
    xterm.writeln("Running tests...");
    xterm.writeln("✓ All tests passed");
    xterm.write("$ ");

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

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-2 border-b border-sidebar-border">
        <h2 className="text-[13px] text-muted-foreground">Terminal</h2>
      </div>
      <div className="flex-1 p-2 overflow-hidden bg-background">
        <div ref={terminalRef} className="h-full" />
      </div>
    </div>
  );
}
