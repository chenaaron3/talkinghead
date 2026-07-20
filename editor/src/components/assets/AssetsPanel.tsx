import { useState } from "react";

import { BRollTab } from "./BRollTab";
import { MusicTab } from "./MusicTab";
import { SfxTab } from "./SfxTab";
import { VfxTab } from "./VfxTab";

type Tab = "broll" | "vfx" | "sfx" | "music";

export function AssetsPanel() {
  const [tab, setTab] = useState<Tab>("broll");

  return (
    <div className="flex min-h-0 flex-col overflow-hidden border-r border-border bg-panel">
      <div className="flex shrink-0 border-b border-border">
        {(
          [
            ["broll", "B-roll"],
            ["vfx", "VFX"],
            ["sfx", "SFX"],
            ["music", "Music"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 px-1 py-1.5 text-[11px] ${
              tab === id
                ? "border-b-2 border-accent text-[#e8eaef]"
                : "text-muted hover:text-[#e8eaef]"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "broll" ? (
        <BRollTab />
      ) : tab === "vfx" ? (
        <VfxTab />
      ) : tab === "sfx" ? (
        <SfxTab />
      ) : (
        <MusicTab />
      )}
    </div>
  );
}
