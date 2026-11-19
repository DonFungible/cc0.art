-- cc0.art schema (Cloudflare D1 / SQLite).
-- Safe to re-run: drops and recreates everything.

DROP TRIGGER IF EXISTS artworks_ai;
DROP TRIGGER IF EXISTS artworks_ad;
DROP TRIGGER IF EXISTS artworks_au;
DROP TABLE IF EXISTS artworks_fts;
DROP TABLE IF EXISTS artworks;

CREATE TABLE artworks (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  date_display TEXT,
  date_start INTEGER,
  date_end INTEGER,
  medium TEXT,
  culture TEXT,
  classification TEXT,
  image_url TEXT NOT NULL,
  thumb_url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  license TEXT NOT NULL,
  license_evidence TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (source, source_id)
);

CREATE INDEX artworks_date_start ON artworks (date_start);
CREATE INDEX artworks_classification ON artworks (classification);

CREATE VIRTUAL TABLE artworks_fts USING fts5(
  title,
  artist,
  medium,
  culture,
  classification,
  content = 'artworks',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER artworks_ai AFTER INSERT ON artworks BEGIN
  INSERT INTO artworks_fts (rowid, title, artist, medium, culture, classification)
  VALUES (new.id, new.title, new.artist, new.medium, new.culture, new.classification);
END;

CREATE TRIGGER artworks_ad AFTER DELETE ON artworks BEGIN
  INSERT INTO artworks_fts (artworks_fts, rowid, title, artist, medium, culture, classification)
  VALUES ('delete', old.id, old.title, old.artist, old.medium, old.culture, old.classification);
END;

CREATE TRIGGER artworks_au AFTER UPDATE ON artworks BEGIN
  INSERT INTO artworks_fts (artworks_fts, rowid, title, artist, medium, culture, classification)
  VALUES ('delete', old.id, old.title, old.artist, old.medium, old.culture, old.classification);
  INSERT INTO artworks_fts (rowid, title, artist, medium, culture, classification)
  VALUES (new.id, new.title, new.artist, new.medium, new.culture, new.classification);
END;
