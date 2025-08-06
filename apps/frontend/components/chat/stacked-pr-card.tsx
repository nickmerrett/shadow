import Link from "next/link";
import { GitBranch } from "lucide-react";
import { Card } from "../ui/card";

export function StackedPRCard({
  stackedTask,
}: {
  stackedTask: { id: string; title: string };
}) {
  return (
    <Link href={`/tasks/${stackedTask.id}`} target="_blank">
      <Card className="hover:bg-card/70 mt-4 gap-1 rounded-lg p-3 text-left">
        <div className="flex items-center gap-2 overflow-hidden font-medium">
          <GitBranch className="size-4" />
          <span className="truncate">{stackedTask.title}</span>
        </div>

        {/* <div className="text-muted-foreground flex items-center gap-2 text-[13px]">
            <div>#{task?.pullRequestNumber}</div>

            <Circle className="fill-muted-foreground size-1 opacity-50" />

            <div className="flex items-center gap-1">
              <span className="text-green-400">+{snapshot.linesAdded}</span>
              <span className="text-red-400">-{snapshot.linesRemoved}</span>
            </div>

            <Circle className="fill-muted-foreground size-1 opacity-50" />

            <div className="flex items-center gap-1">
              <File className="size-3" />
              <span>
                {snapshot.filesChanged} file
                {snapshot.filesChanged !== 1 ? "s" : ""}
              </span>
            </div>

            <Circle className="fill-muted-foreground size-1 opacity-50" />

            <div>{snapshot.commitSha.slice(0, 7)}</div>
          </div> */}
      </Card>
    </Link>
  );
}
