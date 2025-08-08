import type { ReasoningPart } from "@repo/types";
import { Brain } from "lucide-react";
import { ToolComponent } from "./tools/tool";

export function ReasoningComponent({
  part,
}: {
  part: ReasoningPart;
}) {
  return (
    <ToolComponent
      icon={<Brain />}
      title="Thinking..."
      type="warning"
      collapsible
      suffix={part.signature ? "✓" : undefined}
    >
      <div className="text-muted-foreground whitespace-pre-wrap text-sm">
        {part.text}
      </div>
    </ToolComponent>
  );
}

export function RedactedReasoningComponent() {
  return (
    <ToolComponent
      icon={<Brain className="opacity-50" />}
      title="Thinking (redacted)"
      type="warning"
      collapsible
    >
      <div className="text-muted-foreground text-sm italic">
        Reasoning content has been redacted for privacy.
      </div>
    </ToolComponent>
  );
}
