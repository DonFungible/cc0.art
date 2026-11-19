import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Artwork, LicenseEvidence } from "../shared/types";

const API = "https://openaccess-api.clevelandart.org/api/artworks/";
const PAGE_SIZE = 100;
const ROWS_PER_INSERT = 50;
const FIELDS = [
  "id",
  "title",
  "creators",
  "creation_date",
  "creation_date_earliest",
  "creation_date_latest",
  "technique",
  "culture",
  "type",
  "images",
  "url",
  "share_license_status",
  "copyright",
  "updated_at",
].join(",");

interface CmaImage {
  url: string;
}

interface CmaArtwork {
  id: number;
  title: string | null;
  creators: { description: string | null; qualifier: string | null }[] | null;
  creation_date: string | null;
  creation_date_earliest: number | null;
  creation_date_latest: number | null;
  technique: string | null;
  culture: string[] | null;
  type: string | null;
  images: { web?: CmaImage | null; print?: CmaImage | null } | null;
  url: string | null;
  share_license_status: string | null;
  copyright: string | null;
  updated_at: string | null;
}

interface CmaPage {
  info: { total: number };
  data: CmaArtwork[];
}

type Row = Omit<Artwork, "id">;

const { values } = parseArgs({
  options: {
    limit: { type: "string", default: "1000" },
    out: { type: "string", default: "db/seed/cleveland.sql" },
  },
});
const limit = Number.parseInt(values.limit, 10);
if (!Number.isFinite(limit) || limit <= 0) throw new Error(`--limit must be a positive integer, got ${values.limit}`);

function artistName(creator: { description: string | null; qualifier: string | null }): string | null {
  const name = creator.description?.replace(/\s*\(.*$/s, "").trim();
  if (!name) return null;
  return creator.qualifier ? `${creator.qualifier} ${name}` : name;
}

function normalize(record: CmaArtwork, fetchedAt: string): Row | null {
  if (record.share_license_status !== "CC0") return null;
  const thumb = record.images?.web?.url;
  if (!thumb || !record.title) return null;
  const evidence: LicenseEvidence = {
    field: "share_license_status",
    value: record.share_license_status,
    copyright: record.copyright,
    api_url: `${API}${record.id}`,
    fetched_at: fetchedAt,
  };
  const artists = (record.creators ?? []).map(artistName).filter((name): name is string => Boolean(name));
  return {
    source: "cleveland",
    source_id: String(record.id),
    title: record.title,
    artist: artists.length ? artists.join("; ") : null,
    date_display: record.creation_date,
    date_start: record.creation_date_earliest,
    date_end: record.creation_date_latest,
    medium: record.technique,
    culture: record.culture?.length ? record.culture.join("; ") : null,
    classification: record.type,
    image_url: record.images?.print?.url ?? thumb,
    thumb_url: thumb,
    source_url: record.url ?? `https://clevelandart.org/art/collection/search?search=${record.id}`,
    license: "CC0-1.0",
    license_evidence: JSON.stringify(evidence),
    updated_at: record.updated_at ?? fetchedAt,
  };
}

async function fetchPage(skip: number, size: number): Promise<CmaPage> {
  const url = new URL(API);
  url.search = new URLSearchParams({
    cc0: "1",
    has_image: "1",
    limit: String(size),
    skip: String(skip),
    fields: FIELDS,
  }).toString();
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "user-agent": "cc0.art-ingest/0.1 (+https://cc0.art)" } });
    if (res.ok) return (await res.json()) as CmaPage;
    if (attempt >= 4) throw new Error(`${url} -> HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
}

function sqlValue(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.trunc(value)) : "NULL";
  return `'${value.replaceAll("\0", "").replaceAll("'", "''")}'`;
}

const COLUMNS = [
  "source",
  "source_id",
  "title",
  "artist",
  "date_display",
  "date_start",
  "date_end",
  "medium",
  "culture",
  "classification",
  "image_url",
  "thumb_url",
  "source_url",
  "license",
  "license_evidence",
  "updated_at",
] as const satisfies readonly (keyof Row)[];

function toSql(rows: Row[]): string {
  const updates = COLUMNS.filter((c) => c !== "source" && c !== "source_id")
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  const statements: string[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    const tuples = rows
      .slice(i, i + ROWS_PER_INSERT)
      .map((row) => `(${COLUMNS.map((c) => sqlValue(row[c])).join(", ")})`)
      .join(",\n");
    statements.push(
      `INSERT INTO artworks (${COLUMNS.join(", ")}) VALUES\n${tuples}\nON CONFLICT (source, source_id) DO UPDATE SET ${updates};`,
    );
  }
  return statements.join("\n\n") + "\n";
}

const fetchedAt = new Date().toISOString();
const rows = new Map<string, Row>();
let skip = 0;
let skipped = 0;
let total = Infinity;
while (rows.size < limit && skip < total) {
  const page = await fetchPage(skip, PAGE_SIZE);
  total = page.info.total;
  if (!page.data.length) break;
  skip += page.data.length;
  for (const record of page.data) {
    const row = normalize(record, fetchedAt);
    if (!row) {
      skipped++;
      continue;
    }
    if (rows.size < limit) rows.set(row.source_id, row);
  }
  process.stdout.write(`\rfetched ${skip}/${Math.min(total, limit)} kept ${rows.size} skipped ${skipped}`);
}
process.stdout.write("\n");

const out = resolve(values.out);
await mkdir(dirname(out), { recursive: true });
await writeFile(
  out,
  `-- Generated by ingest/cleveland.ts at ${fetchedAt} from ${API}?cc0=1&has_image=1\n` +
    `-- ${rows.size} CC0 artworks. Apply after db/schema.sql.\n\n` +
    toSql([...rows.values()]),
);
console.log(`wrote ${rows.size} rows to ${out}`);
