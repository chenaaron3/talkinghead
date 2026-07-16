import {
  cloneElement,
  isValidElement,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Plus, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";

import type { CaptionEmphasis } from "@src/lib/types";
import { cn } from "../../lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "../ui/popover";

type Props = {
  children: ReactNode;
  disabled?: boolean;
  emphasis: CaptionEmphasis | undefined;
  onEmphasis: (emphasis: CaptionEmphasis | undefined) => void;
  onZoom: () => void;
  onDelete: () => void;
};

type TriggerProps = {
  onContextMenu?: (e: MouseEvent) => void;
};

export function WordContextMenu({
  children,
  disabled = false,
  emphasis,
  onEmphasis,
  onZoom,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);

  const anchor = isValidElement(children)
    ? cloneElement(children as ReactElement<TriggerProps>, {
        onContextMenu: (e: MouseEvent) => {
          (children as ReactElement<TriggerProps>).props.onContextMenu?.(e);
          if (disabled || e.defaultPrevented) return;
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        },
      })
    : children;

  const run = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) {
          setOpen(false);
          return;
        }
        setOpen(next);
      }}
    >
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="flex w-auto min-w-0 flex-row items-center gap-0.5 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <IconButton
          label="Positive emphasis"
          active={emphasis === "positive"}
          activeClass="bg-emerald-700/80 text-emerald-100"
          onClick={() =>
            run(() =>
              onEmphasis(emphasis === "positive" ? undefined : "positive"),
            )
          }
        >
          <ThumbsUp className="size-3.5" />
        </IconButton>
        <IconButton
          label="Negative emphasis"
          active={emphasis === "negative"}
          activeClass="bg-red-800/80 text-red-100"
          onClick={() =>
            run(() =>
              onEmphasis(emphasis === "negative" ? undefined : "negative"),
            )
          }
        >
          <ThumbsDown className="size-3.5" />
        </IconButton>
        <IconButton label="Zoom" onClick={() => run(onZoom)}>
          <Plus className="size-3.5" />
        </IconButton>
        <IconButton
          label="Delete"
          className="text-red-300 hover:bg-red-950/60 hover:text-red-200"
          onClick={() => run(onDelete)}
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </PopoverContent>
    </Popover>
  );
}

function IconButton({
  label,
  active,
  activeClass,
  className,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  activeClass?: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-[#e8eaef] hover:bg-[#3d4a66]",
        active && activeClass,
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
