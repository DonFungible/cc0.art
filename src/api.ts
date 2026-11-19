import type { Artwork, ClassificationCount, SearchResponse } from "../shared/types";

export interface SearchParams {
  q?: string;
  classification?: string;
  from?: string;
  to?: string;
  page?: number;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw Object.assign(new Error(`Request failed: ${res.status}`), { status: res.status });
  return (await res.json()) as T;
}

export function searchArtworks(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return getJson(`/api/search?${query}`, signal);
}

export function fetchArtwork(source: string, id: string, signal?: AbortSignal): Promise<Artwork> {
  return getJson(`/api/artwork/${encodeURIComponent(source)}/${encodeURIComponent(id)}`, signal);
}

export function fetchClassifications(): Promise<ClassificationCount[]> {
  return getJson("/api/classifications");
}
