-- The iPhone interest counter's D1 tables (functions/api/minat-ios.ts). Run once
-- when the owner creates the database (docs/landing/DEPLOY.md). Nothing about a
-- visitor is kept beyond the day: the salt and the hashes of earlier days are
-- deleted on every request; only the counts last.
CREATE TABLE IF NOT EXISTS garam (
  hari TEXT PRIMARY KEY,
  nilai TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS batas (
  hari TEXT NOT NULL,
  hash TEXT NOT NULL,
  jumlah INTEGER NOT NULL,
  PRIMARY KEY (hari, hash)
);
CREATE TABLE IF NOT EXISTS total (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  jumlah INTEGER NOT NULL
);
INSERT OR IGNORE INTO total (id, jumlah) VALUES (1, 0);
CREATE TABLE IF NOT EXISTS harian (
  hari TEXT PRIMARY KEY,
  jumlah INTEGER NOT NULL
);
