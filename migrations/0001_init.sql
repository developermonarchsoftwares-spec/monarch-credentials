-- Monarch Credentials: initial schema (Cloudflare D1 / SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE issuers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  tagline       TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  logo_path     TEXT,
  website       TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address       TEXT,
  signatory_name        TEXT,
  signatory_designation TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- A role may be bound to one issuer (issuer_id) or be global (NULL).
CREATE TABLE roles (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  key       TEXT NOT NULL UNIQUE CHECK (key IN ('super_admin','placements_admin','softwares_admin','viewer')),
  name      TEXT NOT NULL,
  issuer_id INTEGER REFERENCES issuers(id),
  can_write INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  deleted_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

-- Only the SHA-256 of the session token is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE students (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name   TEXT NOT NULL,
  name_key    TEXT NOT NULL,           -- lowercase, whitespace-collapsed full_name (search + dedupe)
  email       TEXT COLLATE NOCASE,     -- private, never public
  phone       TEXT,                    -- private, never public
  notes       TEXT,                    -- private internal notes
  deleted_at  TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX uq_students_email ON students(email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_students_name_key ON students(name_key);

CREATE TABLE certificate_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  issuer_id   INTEGER NOT NULL REFERENCES issuers(id),
  code        TEXT NOT NULL UNIQUE,    -- ID prefix: MPS, MPC, MPR, MSI, MPI
  name        TEXT NOT NULL,           -- credential name shown to the public
  description TEXT NOT NULL DEFAULT '',
  template    TEXT NOT NULL CHECK (template IN ('training','competency','internship','project_internship')),
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE certificates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id  TEXT NOT NULL UNIQUE,     -- public, non-guessable, e.g. MPS-2026-K7Q4M9XB
  student_id      INTEGER NOT NULL REFERENCES students(id),
  issuer_id       INTEGER NOT NULL REFERENCES issuers(id),
  type_id         INTEGER NOT NULL REFERENCES certificate_types(id),
  title           TEXT NOT NULL,            -- certificate title shown on the credential
  programme       TEXT NOT NULL,            -- course / internship programme
  description     TEXT,                     -- optional short public description
  start_date      TEXT,
  completion_date TEXT,
  issue_date      TEXT,                     -- set on publish
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','valid','revoked')),
  published_at    TEXT,
  revoked_at      TEXT,
  revoked_reason  TEXT,
  deleted_at      TEXT,
  created_by      INTEGER REFERENCES users(id),
  published_by    INTEGER REFERENCES users(id),
  revoked_by      INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_certs_student ON certificates(student_id);
CREATE INDEX idx_certs_issuer_status ON certificates(issuer_id, status);
CREATE INDEX idx_certs_status ON certificates(status);
CREATE INDEX idx_certs_published ON certificates(published_at);
CREATE INDEX idx_certs_created ON certificates(created_at);

-- Record of each PDF rendered (PDFs are generated on demand; no object storage required).
CREATE TABLE certificate_files (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id INTEGER NOT NULL REFERENCES certificates(id),
  kind           TEXT NOT NULL DEFAULT 'pdf',
  template       TEXT NOT NULL,
  sha256         TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL,
  generated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_cert_files_cert ON certificate_files(certificate_id);

CREATE TABLE verification_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id INTEGER REFERENCES certificates(id),
  query          TEXT,                       -- certificate ID looked up (truncated)
  channel        TEXT NOT NULL CHECK (channel IN ('page','search','pdf')),
  result         TEXT NOT NULL CHECK (result IN ('valid','revoked','not_found')),
  ip_hash        TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_verif_created ON verification_events(created_at);
CREATE INDEX idx_verif_cert ON verification_events(certificate_id);

CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  user_email  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  details     TEXT,                          -- JSON, never contains secrets
  ip_hash     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- Fixed-window rate limiting counters.
CREATE TABLE rate_limits (
  bucket       TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
