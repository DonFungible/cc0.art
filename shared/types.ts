export interface Artwork {
  id: number;
  source: string;
  source_id: string;
  title: string;
  artist: string | null;
  date_display: string | null;
  date_start: number | null;
  date_end: number | null;
  medium: string | null;
  culture: string | null;
  classification: string | null;
  image_url: string;
  thumb_url: string;
  source_url: string;
  license: string;
  license_evidence: string;
  updated_at: string;
}

export type ArtworkSummary = Pick<
  Artwork,
  "source" | "source_id" | "title" | "artist" | "date_display" | "classification" | "thumb_url"
>;

export interface SearchResponse {
  results: ArtworkSummary[];
  total?: number;
  page: number;
  pageSize: number;
}

export interface ClassificationCount {
  classification: string;
  count: number;
}

export interface LicenseEvidence {
  field: string;
  value: string;
  copyright: string | null;
  api_url: string;
  fetched_at: string;
}

export const SOURCE_NAMES: Record<string, string> = {
  cleveland: "The Cleveland Museum of Art",
};
