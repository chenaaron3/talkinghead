import * as React from "react";
import {
  useDropzone,
  type DropzoneOptions,
  type DropzoneState,
} from "react-dropzone";

import { cn } from "../../lib/utils";

export type { DropzoneState };

export type DropzoneProps = Omit<DropzoneOptions, "children"> & {
  className?: string;
  children?: React.ReactNode | ((state: DropzoneState) => React.ReactNode);
};

/**
 * shadcn-style dropzone built on react-dropzone.
 * Pass a render-prop child to react to drag state.
 */
export function Dropzone({
  className,
  children,
  disabled,
  ...options
}: DropzoneProps) {
  const dropzone = useDropzone({ disabled, ...options });

  return (
    <div
      data-slot="dropzone"
      data-dragging={dropzone.isDragActive || undefined}
      {...dropzone.getRootProps({
        className: cn(
          "relative outline-none",
          dropzone.isDragActive && "ring-2 ring-inset ring-accent",
          disabled && "pointer-events-none opacity-50",
          className,
        ),
      })}
    >
      <input {...dropzone.getInputProps()} />
      {typeof children === "function" ? children(dropzone) : children}
    </div>
  );
}
