import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "../../../lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../ui/collapsible";

/** Full-width inspector section with a top-rule header and chevron. */
export function InspectorCollapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="w-full min-w-0"
    >
      <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-1.5 border-t border-border pt-3 text-left hover:opacity-90">
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium tracking-wide text-muted uppercase">
          {title}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="w-full min-w-0">
        <div className="flex w-full min-w-0 max-w-full flex-col gap-4 pt-3">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
