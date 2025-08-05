import Link from "next/link";
import { GitBranch } from "lucide-react";

export function StackedPRCard({
  stackedTask,
}: {
  stackedTask: { id: string; title: string };
}) {
  return (
    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <div className="flex items-center gap-2 font-medium text-red-800">
        <GitBranch className="size-4" />
        <span>Stacked PR Created</span>
      </div>
      <div className="mt-1 text-sm text-red-700">{stackedTask.title}</div>
      <Link
        href={`/tasks/${stackedTask.id}`}
        className="text-sm text-red-600 underline transition-colors hover:text-red-800"
      >
        View Task →
      </Link>
    </div>
  );
}
