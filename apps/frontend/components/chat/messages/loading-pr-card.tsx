import { Card } from "@/components/ui/card";
import { Circle, File } from "lucide-react";
import Image from "next/image";

export function LoadingPRCard() {
  return (
    <>
      <Card className="hover:bg-card/70 mt-4 gap-1 rounded-lg p-3 text-left">
        <div className="flex items-center gap-2 overflow-hidden font-medium">
          <Image src="/github.svg" alt="GitHub" width={16} height={16} />
          <div className="bg-muted/30 h-4 w-48 animate-pulse rounded"></div>
        </div>

        <div className="text-muted-foreground flex items-center gap-2 text-[13px]">
          <div className="bg-muted/30 h-3 w-8 animate-pulse rounded"></div>

          <Circle className="fill-muted-foreground size-1 opacity-50" />

          <div className="flex items-center gap-1">
            <div className="h-3 w-6 animate-pulse rounded bg-green-400/30"></div>
            <div className="bg-destructive/30 h-3 w-6 animate-pulse rounded"></div>
          </div>

          <Circle className="fill-muted-foreground size-1 opacity-50" />

          <div className="flex items-center gap-1">
            <File className="size-3" />
            <div className="bg-muted/30 h-3 w-10 animate-pulse rounded"></div>
          </div>

          <Circle className="fill-muted-foreground size-1 opacity-50" />

          <div className="bg-muted/30 h-3 w-12 animate-pulse rounded"></div>
        </div>
      </Card>

      <div className="mt-3 p-3">
        <div className="space-y-3">
          <div className="bg-muted/30 h-4 w-20 animate-pulse rounded"></div>
          <div className="space-y-2">
            <div className="bg-muted/30 h-3 w-full animate-pulse rounded"></div>
            <div className="bg-muted/30 h-3 w-3/4 animate-pulse rounded"></div>
            <div className="bg-muted/30 h-3 w-1/2 animate-pulse rounded"></div>
          </div>
        </div>
      </div>
    </>
  );
}
