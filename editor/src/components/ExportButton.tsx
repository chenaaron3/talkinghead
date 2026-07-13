import { useState } from "react";
import { useEditor } from "../store";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

type ExportEvent =
  | {
      type: "progress";
      phase: "bundle" | "video" | "cover";
      progress: number;
      overall: number;
    }
  | { type: "done"; downloadUrl: string; filename: string }
  | { type: "error"; error: string };

const PHASE_LABEL = {
  bundle: "Bundling",
  video: "Rendering",
  cover: "Cover",
} as const;

export function ExportButton() {
  const props = useEditor((s) => s.props);
  const dirty = useEditor((s) => s.dirty);
  const save = useEditor((s) => s.save);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!props) return null;

  const onExport = async () => {
    setExporting(true);
    setError(null);
    setProgress(0);
    setPhase("Starting");
    try {
      if (dirty) await save();
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: useEditor.getState().config,
          transcript: useEditor.getState().transcript,
        }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `Export failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let downloadUrl: string | null = null;
      let filename = `${props.episodeId}.mp4`;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ExportEvent;
          if (event.type === "progress") {
            setProgress(event.overall);
            setPhase(PHASE_LABEL[event.phase]);
          } else if (event.type === "done") {
            downloadUrl = event.downloadUrl;
            filename = event.filename;
            setProgress(1);
            setPhase("Downloading");
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }

      if (!downloadUrl) throw new Error("Export finished without a download");

      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) throw new Error("Failed to download rendered video");
      const blob = await fileRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
      setPhase(null);
      setProgress(0);
    }
  };

  const pct = Math.round(progress * 100);

  return (
    <div className="flex w-full max-w-[240px] flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={exporting}
        onClick={() => void onExport()}
      >
        {exporting ? `${phase ?? "Exporting"}… ${pct}%` : "Export"}
      </Button>
      {exporting ? <Progress value={pct} className="h-1.5" /> : null}
      {error ? (
        <p className="text-center text-[11px] text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
