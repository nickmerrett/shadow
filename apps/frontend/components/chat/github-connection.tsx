import { Folder, GitBranch } from "lucide-react";
import { Button } from "../ui/button";

export function GithubConnection() {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-muted-foreground hover:bg-accent font-normal"
    >
      <Folder className="size-4" />
      <span>ishaan1013/shadow</span>
      <GitBranch className="size-4" />
      <span>main</span>
    </Button>
  );
}
