"use client";

import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@repo/types";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4001";

export const socket: TypedSocket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  forceNew: false,
});
