import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SidebarCodebase } from "@/lib/db-operations/get-codebases";
import { LayoutGrid, Clock, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { useDebounceCallback } from "@/lib/debounce";
import { formatTimeAgo } from "@/lib/utils";

export function SidebarCodebasesListView({
  codebases,
  loading,
  error,
}: {
  codebases: SidebarCodebase[];
  loading: boolean;
  error: Error | null;
}) {
  const searchFormRef = useRef<HTMLFormElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Debounced search handler
  const debouncedSearch = useDebounceCallback((query: string) => {
    setSearchQuery(query);
  }, 300);

  // Filter codebases based on search query
  const filteredCodebases = codebases
    .filter((codebase) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase().trim();
      return codebase.repoFullName.toLowerCase().includes(query);
    })
    // Sort by updated date (most recent first)
    .sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return (
    <>
      {/* Search Input */}
      <SidebarGroup>
        <form ref={searchFormRef} className="relative">
          <Search className="text-muted-foreground absolute left-2 top-1/2 size-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search codebases..."
            className="h-8 px-7"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="iconXs"
              className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 -translate-y-1/2 rounded p-0"
              onClick={() => {
                setSearchQuery("");
                searchFormRef.current?.reset();
              }}
            >
              <X className="size-3.5" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </form>
      </SidebarGroup>

      {loading && (
        <SidebarGroup>
          <SidebarGroupLabel>Loading codebases...</SidebarGroupLabel>
        </SidebarGroup>
      )}

      {error && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-destructive">
            Error: {error instanceof Error ? error.message : String(error)}
          </SidebarGroupLabel>
        </SidebarGroup>
      )}

      {!loading && !error && filteredCodebases.length > 0 ? (
        <SidebarGroup>
          <SidebarGroupContent>
            {filteredCodebases.map((codebase) => (
              <SidebarMenuItem key={codebase.id}>
                <SidebarMenuButton
                  className="flex h-auto flex-col items-start gap-0"
                  asChild
                >
                  <a href={`/codebases/${codebase.id}`}>
                    <div className="flex w-full items-center gap-1.5">
                      <div className="line-clamp-1 flex-1">
                        {codebase.repoFullName}
                      </div>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1 text-xs">
                      <LayoutGrid className="size-3 shrink-0" />
                      <span className="mr-0.5">
                        {codebase.tasks.length} Task
                        {codebase.tasks.length !== 1 ? "s" : ""}
                      </span>
                      <Clock className="size-3 shrink-0" />
                      <span>
                        {formatTimeAgo(
                          typeof codebase.updatedAt === "string"
                            ? codebase.updatedAt
                            : codebase.updatedAt.toISOString()
                        )}
                      </span>
                    </div>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      ) : filteredCodebases.length === 0 ? (
        searchQuery ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground hover:text-muted-foreground">
              No codebases match "{searchQuery}".
            </SidebarGroupLabel>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground hover:text-muted-foreground h-auto px-0 pt-2 leading-tight">
              No codebases found. Start a new task to see repositories here.
            </SidebarGroupLabel>
          </SidebarGroup>
        )
      ) : null}
    </>
  );
}
