import { useEffect, useRef, useState } from "react";

import { episodeHeaders } from "../../../lib/api";
import { Label } from "../../ui/label";

export type AddressPlace = {
  placeId: string;
  label: string;
  lat: number;
  lon: number;
};

export function AddressField({
  label = "Address",
  value,
  resolvedLabel,
  episodeId,
  onSelect,
}: {
  label?: string;
  /** Current place label (resets the search input when it changes). */
  value?: string;
  /** Shown under the input when a place is already resolved. */
  resolvedLabel?: string | null;
  episodeId: string | null;
  onSelect: (place: AddressPlace) => Promise<void>;
}) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<AddressPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q === (value ?? "").trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    if (!episodeId) return;

    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/vfx/geocode?q=${encodeURIComponent(q)}`,
          { headers: episodeHeaders(episodeId) },
        );
        const data = (await res.json()) as {
          results?: AddressPlace[];
          error?: string;
        };
        if (seq !== searchSeq.current) return;
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setResults(data.results ?? []);
        setError(null);
      } catch (err) {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query, episodeId, value]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search address…"
        disabled={!episodeId || busy}
        className="w-full rounded-md border border-border bg-panel-2 px-2 py-1.5 text-[11px] text-[#e8eaef] outline-none placeholder:text-muted focus:border-accent"
      />
      {resolvedLabel ? (
        <p className="truncate text-[10px] text-muted" title={resolvedLabel}>
          {resolvedLabel}
        </p>
      ) : null}
      {searching ? <p className="text-[10px] text-muted">Searching…</p> : null}
      {results.length > 0 ? (
        <ul className="max-h-40 overflow-auto rounded-md border border-border bg-panel-2">
          {results.map((place) => (
            <li key={place.placeId}>
              <button
                type="button"
                disabled={busy}
                className="w-full truncate px-2 py-1.5 text-left text-[11px] text-[#e8eaef] hover:bg-accent/20 disabled:opacity-50"
                title={place.label}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await onSelect(place);
                      setQuery(
                        place.label.split(",")[0]?.trim() || place.label,
                      );
                      setResults([]);
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : String(err),
                      );
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {busy ? <p className="text-[10px] text-muted">Saving…</p> : null}
      {error ? <p className="text-[10px] text-red-400">{error}</p> : null}
    </div>
  );
}
