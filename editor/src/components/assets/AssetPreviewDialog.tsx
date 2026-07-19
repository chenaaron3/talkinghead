import { isVideoSrc } from "../../lib/broll";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

import type { LibraryAsset } from "../../store";

export function AssetPreviewDialog({
  asset,
  onClose,
}: {
  asset: LibraryAsset | null;
  onClose: () => void;
}) {
  const video = asset != null && isVideoSrc(asset.src);

  return (
    <Dialog
      open={asset != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="gap-1 px-4 py-3 pr-12">
          <DialogTitle className="truncate text-base">
            {asset?.label ?? "Preview"}
          </DialogTitle>
          {asset?.durationSec != null ? (
            <DialogDescription>
              {asset.durationSec.toFixed(1)}s
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="flex max-h-[70vh] items-center justify-center bg-black">
          {asset == null ? null : video ? (
            <video
              key={asset.key}
              src={`/${asset.src}`}
              controls
              autoPlay
              playsInline
              className="max-h-[70vh] w-full"
            />
          ) : (
            <img
              src={asset.thumbUrl}
              alt={asset.label}
              className="max-h-[70vh] w-full object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
