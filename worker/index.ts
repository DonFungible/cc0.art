import type { Artwork, ArtworkSummary, ClassificationCount, SearchResponse } from "../shared/types";
import { SOURCE_NAMES } from "../shared/types";

interface Env {
  ASSETS: Fetcher;
  DB_CLEVELAND: D1Database;
}

const PAGE_SIZE = 40;
const MAX_PAGE = 100;
const MAX_TERMS = 8;
const SEARCH_CACHE = "public, max-age=60, s-maxage=600";
const RECORD_CACHE = "public, max-age=300, s-maxage=3600";
const SUMMARY_COLUMNS = "a.source, a.source_id, a.title, a.artist, a.date_display, a.classification, a.thumb_url";

function json(body: unknown, init: { status?: number; cache?: string } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": init.cache ?? "no-store",
    },
  });
}

function toFtsQuery(input: string): string | null {
  const terms = input.normalize("NFKC").match(/[\p{L}\p{N}]+/gu)?.slice(0, MAX_TERMS);
  if (!terms?.length) return null;
  return terms.map((term, i) => (i === terms.length - 1 ? `"${term}"*` : `"${term}"`)).join(" ");
}

function parseYear(value: string | null): number | null {
  if (!value || !/^-?\d{1,4}$/.test(value.trim())) return null;
  return Number.parseInt(value, 10);
}

async function search(url: URL, env: Env): Promise<Response> {
  const params = url.searchParams;
  const page = Math.min(Math.max(Number.parseInt(params.get("page") ?? "1", 10) || 1, 1), MAX_PAGE);
  const match = toFtsQuery(params.get("q") ?? "");
  const classification = params.get("classification")?.trim() || null;
  const from = parseYear(params.get("from"));
  const to = parseYear(params.get("to"));

  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (match) {
    where.push("artworks_fts MATCH ?");
    binds.push(match);
  }
  if (classification) {
    where.push("a.classification = ?");
    binds.push(classification);
  }
  if (from !== null) {
    where.push("COALESCE(a.date_end, a.date_start) >= ?");
    binds.push(from);
  }
  if (to !== null) {
    where.push("a.date_start <= ?");
    binds.push(to);
  }

  const from_ = match ? "artworks_fts JOIN artworks a ON a.id = artworks_fts.rowid" : "artworks a";
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const seed = Math.floor(Date.now() / 86_400_000) % 9973;
  const order = match
    ? "bm25(artworks_fts, 10.0, 6.0, 2.0, 2.0, 3.0), a.id"
    : `((a.id * 2654435761 + ${seed}) % 4294967291), a.id`;
  const db = env.DB_CLEVELAND;
  const resultsQuery = db
    .prepare(`SELECT ${SUMMARY_COLUMNS} FROM ${from_} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .bind(...binds, PAGE_SIZE, (page - 1) * PAGE_SIZE);

  try {
    const body: SearchResponse = { results: [], page, pageSize: PAGE_SIZE };
    if (page === 1) {
      const [results, count] = await db.batch<ArtworkSummary | { total: number }>([
        resultsQuery,
        db.prepare(`SELECT count(*) AS total FROM ${from_} ${whereSql}`).bind(...binds),
      ]);
      body.results = results.results as ArtworkSummary[];
      body.total = (count.results[0] as { total: number }).total;
    } else {
      body.results = (await resultsQuery.all<ArtworkSummary>()).results;
    }
    return json(body, { cache: SEARCH_CACHE });
  } catch (err) {
    console.error("search failed", match, err);
    return json({ error: "Search failed" }, { status: 500 });
  }
}

async function getArtwork(env: Env, source: string, sourceId: string): Promise<Artwork | null> {
  return env.DB_CLEVELAND.prepare("SELECT * FROM artworks WHERE source = ? AND source_id = ?")
    .bind(source, sourceId)
    .first<Artwork>();
}

async function classifications(env: Env): Promise<Response> {
  const { results } = await env.DB_CLEVELAND.prepare(
    "SELECT classification, count(*) AS count FROM artworks WHERE classification IS NOT NULL GROUP BY classification ORDER BY count DESC, classification",
  ).all<ClassificationCount>();
  return json(results, { cache: RECORD_CACHE });
}

async function withEdgeCache(request: Request, ctx: ExecutionContext, handler: () => Promise<Response>): Promise<Response> {
  const cache = caches.default;
  const url = new URL(request.url);
  url.searchParams.sort();
  const key = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(key);
  if (cached) return cached;
  const response = await handler();
  if (response.ok) ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function describe(art: Artwork): string {
  const parts = [art.artist, art.date_display, art.medium].filter(Boolean).join(", ");
  const source = SOURCE_NAMES[art.source] ?? art.source;
  return `${parts ? `${parts}. ` : ""}Public domain (CC0) from ${source}. Free to download and reuse.`;
}

async function artPage(request: Request, env: Env, url: URL, source: string, sourceId: string): Promise<Response> {
  const [shell, art] = await Promise.all([
    env.ASSETS.fetch(new Request(new URL("/", url), { headers: { accept: "text/html" } })),
    getArtwork(env, source, sourceId).catch(() => null),
  ]);
  const headers = new Headers(shell.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=300");
  headers.delete("etag");
  if (!art) return new Response(shell.body, { status: 404, headers });

  const title = `${art.title}${art.artist ? ` — ${art.artist}` : ""} | cc0.art`;
  const description = describe(art);
  const canonical = new URL(`/art/${encodeURIComponent(source)}/${encodeURIComponent(sourceId)}`, url).toString();
  const meta: [string, string, string][] = [
    ["name", "description", description],
    ["property", "og:type", "article"],
    ["property", "og:site_name", "cc0.art"],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:image", art.thumb_url],
    ["property", "og:url", canonical],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
    ["name", "twitter:image", art.thumb_url],
  ];
  const tags =
    meta.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}">`).join("\n    ") +
    `\n    <link rel="canonical" href="${escapeHtml(canonical)}">`;

  const rewritten = new HTMLRewriter()
    .on("title", { element: (el) => void el.setInnerContent(title) })
    .on('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]', {
      element: (el) => void el.remove(),
    })
    .on("head", { element: (el) => void el.append(tags, { html: true }) })
    .transform(new Response(shell.body, { status: 200, headers }));
  return request.method === "HEAD" ? new Response(null, rewritten) : rewritten;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    if (pathname === "/api/search") return withEdgeCache(request, ctx, () => search(url, env));
    if (pathname === "/api/classifications") return withEdgeCache(request, ctx, () => classifications(env));

    const apiArt = pathname.match(/^\/api\/artwork\/([^/]+)\/([^/]+)\/?$/);
    if (apiArt) {
      const art = await getArtwork(env, decodeURIComponent(apiArt[1]), decodeURIComponent(apiArt[2]));
      return art ? json(art, { cache: RECORD_CACHE }) : json({ error: "Not found" }, { status: 404 });
    }
    if (pathname.startsWith("/api/")) return json({ error: "Not found" }, { status: 404 });

    const page = pathname.match(/^\/art\/([^/]+)\/([^/]+)\/?$/);
    if (page) return artPage(request, env, url, decodeURIComponent(page[1]), decodeURIComponent(page[2]));

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
