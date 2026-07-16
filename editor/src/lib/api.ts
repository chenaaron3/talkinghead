export function episodeHeaders(episodeId: string | null): HeadersInit {
  if (!episodeId) return {};
  return { "X-Episode-Id": episodeId };
}

export function episodeQuery(episodeId: string | null): string {
  if (!episodeId) return "";
  return `?episodeId=${encodeURIComponent(episodeId)}`;
}
