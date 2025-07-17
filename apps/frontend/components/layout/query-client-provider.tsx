"use client";

import { queryClient } from "@/lib/query-client";
import { QueryClientProvider as ReactQueryClientProvider } from "@tanstack/react-query";

export function QueryClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReactQueryClientProvider client={queryClient}>
      {children}
    </ReactQueryClientProvider>
  );
}
