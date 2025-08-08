import { ToolTypes, type ReasoningPart } from "@repo/types";
import { ChevronDown } from "lucide-react";
import { ToolComponent } from "./tools/tool";

export function ReasoningComponent({ part }: { part: ReasoningPart }) {
  return (
    <ToolComponent
      icon={<ChevronDown />}
      collapsible
      type={ToolTypes.REASONING}
    >
      <div className="text-muted-foreground whitespace-pre-wrap text-sm">
        {part.text}
      </div>
    </ToolComponent>
  );
}

export function RedactedReasoningComponent() {
  return (
    <ToolComponent collapsible type={ToolTypes.REDACTED_REASONING}>
      <div className="text-muted-foreground text-sm italic">
        Reasoning content has been redacted by Anthropic.
      </div>
    </ToolComponent>
  );
}
