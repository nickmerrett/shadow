import Link from "next/link";
import { GitBranch, Circle } from "lucide-react";
import { Card } from "../ui/card";
import { useStackedPRInfo } from "@/hooks/use-stacked-pr-info";
import { statusColorsConfig } from "../sidebar/status";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@repo/db";

type StackedTask = {
  id: string;
  title: string;
  shadowBranch?: string;
};

export function StackedPRCard({
  stackedTask,
}: {
  stackedTask: StackedTask;
}) {
  const { data: stackedPRInfo, isLoading } = useStackedPRInfo(
    stackedTask.id,
    stackedTask
  );

  const status = (stackedPRInfo?.status as TaskStatus) || "INITIALIZING";
  const title = stackedPRInfo?.title || stackedTask.title;
  const shadowBranch = stackedPRInfo?.shadowBranch || stackedTask.shadowBranch;
  
  const statusConfig = statusColorsConfig[status];
  const StatusIcon = statusConfig.icon;

  return (
    <Link href={`/tasks/${stackedTask.id}`} target="_blank">
      <Card className="hover:bg-card/70 mt-4 gap-1 rounded-lg p-3 text-left">
        <div className="flex items-center gap-2 overflow-hidden font-medium">
          <GitBranch className="size-4" />
          <span className="truncate">{title}</span>
        </div>

        <div className="text-muted-foreground flex items-center gap-2 text-[13px] mt-1">
          <div className="flex items-center gap-1">
            <StatusIcon 
              className={cn("size-3", statusConfig.className, {
                "animate-spin": isLoading && status === "INITIALIZING"
              })} 
            />
            <span className="capitalize">{status.toLowerCase().replace('_', ' ')}</span>
          </div>

          {shadowBranch && (
            <>
              <Circle className="fill-muted-foreground size-1 opacity-50" />
              <span className="text-xs font-mono">{shadowBranch}</span>
            </>
          )}
        </div>
      </Card>
    </Link>
  );
}
