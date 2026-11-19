# cc0.art

A search engine for CC0 / public-domain artwork. Vue 3 SPA + a single Cloudflare Worker (static assets + JSON API) backed by Cloudflare D1 with SQLite FTS5. Runs on Cloudflare's free tier.

## Layout

| Path | What |
| --- | --- |
| `src/` | Vue 3 app (`<script setup>`, vue-router, VueUse, plain CSS) |
| `worker/index.ts` | Worker: `/api/*` JSON API and `/art/*` HTML with injected social meta tags |
| `shared/types.ts` | Types shared by the app, Worker, and ingest |
| `db/schema.sql` | `artworks` table, FTS5 external-content index, triggers |
| `ingest/cleveland.ts` | Cleveland Museum of Art Open Access fetcher → `db/seed/cleveland.sql` |

## Setup

Requires Node 20+.

```sh
npm install
npm run ingest -- --limit 1000   # writes db/seed/cleveland.sql (gitignored)
npm run db:load:local            # applies db/schema.sql + seed to local D1 (.wrangler/state)
npm run dev                      # http://localhost:5173
```

`db:load:local` drops and recreates the tables, so re-running it after a fresh ingest gives you a clean database. The seed itself is an upsert on `(source, source_id)`, so it can also be re-applied on top of existing data.

## Checks

```sh
npm run typecheck   # vue-tsc -b over app, worker and node configs
npm run build       # client bundle + worker into dist/
npm run preview     # serve the production build locally with workerd
```

## API

- `GET /api/search?q=&classification=&from=&to=&page=` — FTS5 search ranked with bm25 (title weighted highest). Every word is quoted and the last one is prefix-matched, so user input can never produce FTS syntax errors. Empty `q` returns a browse order that reshuffles daily. Page size is 40; `total` is included on page 1 only. `from`/`to` are years (negative for BCE) and match works whose date range overlaps.
- `GET /api/artwork/:source/:id` — one record, including `license_evidence`.
- `GET /api/classifications` — classification values with counts, for the filter.
- `GET /art/:source/:id` — the SPA's `index.html` with `<title>`, description, Open Graph, and Twitter card tags injected by `HTMLRewriter`.

Search responses are cached in `caches.default` (note: the Cache API is a no-op on `*.workers.dev`; it works on a custom domain).

## Deploy

```sh
npx wrangler login
npx wrangler d1 create cc0-cleveland        # copy the database_id into wrangler.jsonc
npm run db:load:remote                      # schema + seed into the remote D1
npm run deploy                              # vite build && wrangler deploy
```

Free-tier notes: 1000 rows is ~600 KB of SQL and far under D1's 5 GB / 5M reads-per-day limits. The full Cleveland CC0 set (~42k with images) also fits; `npm run ingest -- --limit 50000`.

## Data notes (Cleveland)

The Open Access API has no `medium`, `classification`, or plain artist-name fields, so the ingest maps:

| Schema | Cleveland field |
| --- | --- |
| `source_id` | `id` (numeric CMA id, also valid at `/api/artworks/:id`) |
| `artist` | `creators[].description` with the parenthetical bio stripped, prefixed by `qualifier` (e.g. "attributed to"), joined with `; ` |
| `date_display` / `date_start` / `date_end` | `creation_date` / `creation_date_earliest` / `creation_date_latest` |
| `medium` | `technique` |
| `culture` | `culture` (array, joined with `; `) |
| `classification` | `type` |
| `thumb_url` / `image_url` | `images.web.url` (~900px JPEG) / `images.print.url` (~3400px JPEG) |
| `source_url` | `url` |
| `license_evidence` | JSON: `share_license_status` value, `copyright`, per-record API URL, fetch time |

Only records with `share_license_status === "CC0"` and a web image are kept.
