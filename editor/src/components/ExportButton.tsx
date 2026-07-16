import { useState } from "react";
import { episodeHeaders } from "../lib/api";
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

type ScheduleEvent =
  | { type: "log"; line: string }
  | { type: "done" }
  | { type: "error"; error: string };

const PHASE_LABEL = {
  bundle: "Bundling",
  video: "Rendering",
  cover: "Cover",
} as const;

async function readNdjson<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: T) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as T);
    }
  }
}

async function downloadRenderedVideo(episodeId: string, filename: string) {
  const fileRes = await fetch("/api/export/download", {
    headers: episodeHeaders(episodeId),
  });
  if (!fileRes.ok) {
    throw new Error("No exported video yet");
  }
  const blob = await fileRes.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ compact = false }: { compact?: boolean }) {
  const props = useEditor((s) => s.props);
  const episodeId = useEditor((s) => s.episodeId);
  const dirty = useEditor((s) => s.dirty);
  const scheduledLabel = useEditor((s) => s.scheduledLabel);
  const fullyScheduled = useEditor((s) => s.fullyScheduled);
  const save = useEditor((s) => s.save);
  const refreshSchedule = useEditor((s) => s.refreshSchedule);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!props || !episodeId) return null;

  const onDownload = async () => {
    setExporting(true);
    setError(null);
    setPhase("Downloading");
    try {
      await downloadRenderedVideo(episodeId, `${episodeId}.mp4`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.split("\n")[0] ?? message);
    } finally {
      setExporting(false);
      setPhase(null);
    }
  };

  const onExportAndSchedule = async () => {
    if (
      !window.confirm(
        `Export "${episodeId}" and schedule it on all configured platforms? This renders the video, then opens browser automation.`,
      )
    ) {
      return;
    }

    setExporting(true);
    setError(null);
    setProgress(0);
    setPhase("Starting");
    try {
      if (dirty) await save();

      const exportRes = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...episodeHeaders(episodeId),
        },
        body: JSON.stringify({
          config: useEditor.getState().config,
          transcript: useEditor.getState().transcript,
        }),
      });
      if (!exportRes.ok || !exportRes.body) {
        const data = (await exportRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `Export failed (${exportRes.status})`);
      }

      let exportDone = false;
      await readNdjson<ExportEvent>(exportRes.body, (event) => {
        if (event.type === "progress") {
          setProgress(event.overall);
          setPhase(PHASE_LABEL[event.phase]);
        } else if (event.type === "done") {
          exportDone = true;
          setProgress(1);
          setPhase("Scheduling");
        } else if (event.type === "error") {
          throw new Error(event.error);
        }
      });
      if (!exportDone) throw new Error("Export finished without completing");

      const scheduleRes = await fetch("/api/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...episodeHeaders(episodeId),
        },
      });
      if (!scheduleRes.ok || !scheduleRes.body) {
        const data = (await scheduleRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `Schedule failed (${scheduleRes.status})`);
      }

      await readNdjson<ScheduleEvent>(scheduleRes.body, (event) => {
        if (event.type === "log") {
          setPhase(event.line.replace(/^\[[^\]]+\]\s*/, ""));
        } else if (event.type === "error") {
          throw new Error(event.error);
        }
      });

      await refreshSchedule();
      setPhase("Done");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message.split("\n")[0] ?? message);
      setPhase(null);
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  const onClick = () => {
    if (fullyScheduled) {
      void onDownload();
    } else {
      void onExportAndSchedule();
    }
  };

  const pct = Math.round(progress * 100);
  const busyLabel =
    phase === "Scheduling" || phase === "Done" || phase === "Downloading"
      ? phase
      : `${phase ?? "Exporting"}… ${pct}%`;
  const buttonLabel = exporting
    ? "Working…"
    : fullyScheduled
      ? "Download"
      : "Export";

  const scheduleIndicator =
    fullyScheduled && scheduledLabel ? (
      <span
        className="max-w-[220px] truncate text-xs text-accent"
        title={`Scheduled for ${scheduledLabel}`}
      >
        Scheduled {scheduledLabel}
      </span>
    ) : null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {scheduleIndicator}
        {exporting ? (
          <span className="max-w-[220px] truncate text-xs text-muted">
            {busyLabel}
          </span>
        ) : null}
        {error ? (
          <span
            className="max-w-[220px] truncate text-xs text-red-300"
            title={error}
          >
            {error}
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={onClick}
        >
          {buttonLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {scheduleIndicator}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={exporting}
        onClick={onClick}
      >
        {exporting ? busyLabel : buttonLabel}
      </Button>
      {exporting && !fullyScheduled && phase !== "Scheduling" && phase !== "Done" ? (
        <Progress value={pct} className="h-1.5" />
      ) : null}
      {error ? (
        <p className="text-center text-[11px] text-red-300" title={error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
