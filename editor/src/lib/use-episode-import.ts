import { useCallback, useRef, useState } from "react";

import { useEditor } from "../store";

export type EpisodeImportJob = {
  id: string;
  filename: string;
  status: "queued" | "processing" | "done" | "failed";
  episodeId?: string;
  error?: string;
};

type QueuedImport = {
  job: EpisodeImportJob;
  file: File;
};

let importJobSeq = 0;

export function useEpisodeImport(opts: {
  onEpisodesChanged?: () => void;
}) {
  const switchEpisode = useEditor((s) => s.switchEpisode);
  const [importJobs, setImportJobs] = useState<EpisodeImportJob[]>([]);
  const importRunningRef = useRef(false);
  const importQueueRef = useRef<QueuedImport[]>([]);
  const onEpisodesChangedRef = useRef(opts.onEpisodesChanged);
  onEpisodesChangedRef.current = opts.onEpisodesChanged;

  const patchJob = useCallback((id: string, patch: Partial<EpisodeImportJob>) => {
    setImportJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  }, []);

  const drainImportQueue = useCallback(async () => {
    if (importRunningRef.current) return;
    importRunningRef.current = true;
    let lastSuccessId: string | null = null;

    try {
      while (importQueueRef.current.length > 0) {
        const next = importQueueRef.current.shift()!;
        patchJob(next.job.id, { status: "processing" });

        try {
          const res = await fetch("/api/import-episode", {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "X-Filename": encodeURIComponent(next.file.name),
            },
            body: next.file,
          });
          const data = (await res.json()) as {
            episodeId?: string;
            error?: string;
          };
          if (!res.ok) {
            throw new Error(data.error ?? "Import failed");
          }
          if (!data.episodeId) throw new Error("Import returned no episode id");
          patchJob(next.job.id, {
            status: "done",
            episodeId: data.episodeId,
          });
          lastSuccessId = data.episodeId;
          onEpisodesChangedRef.current?.();
        } catch (err) {
          patchJob(next.job.id, {
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (lastSuccessId) {
        await switchEpisode(lastSuccessId);
        onEpisodesChangedRef.current?.();
      }
    } finally {
      importRunningRef.current = false;
      if (importQueueRef.current.length > 0) {
        void drainImportQueue();
      }
    }
  }, [patchJob, switchEpisode]);

  const importVideos = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const queued: QueuedImport[] = files.map((file) => {
        const job: EpisodeImportJob = {
          id: `import-${++importJobSeq}`,
          filename: file.name,
          status: "queued",
        };
        return { job, file };
      });
      importQueueRef.current.push(...queued);
      setImportJobs((prev) => [...prev, ...queued.map((q) => q.job)]);
      void drainImportQueue();
    },
    [drainImportQueue],
  );

  return { importJobs, importVideos };
}
