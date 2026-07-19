CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('SPOTIFY', 'GOOGLE')),
  encrypted_refresh_token TEXT NOT NULL,
  encrypted_access_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE TABLE migration_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_playlist_id TEXT NOT NULL,
  source_playlist_name TEXT NOT NULL,
  target_playlist_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'REVIEWING', 'EXPORTING', 'COMPLETED', 'FAILED')),
  total_tracks INTEGER NOT NULL DEFAULT 0,
  processed_tracks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE job_items (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
  spotify_track_id TEXT NOT NULL,
  spotify_title TEXT NOT NULL,
  spotify_artist TEXT NOT NULL,
  spotify_duration_ms INTEGER NOT NULL,
  youtube_video_id TEXT,
  youtube_title TEXT,
  youtube_duration_ms INTEGER,
  confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  match_status TEXT NOT NULL CHECK (match_status IN ('AUTO_APPROVED', 'NEEDS_REVIEW', 'USER_OVERRIDDEN', 'REJECTED')),
  export_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (export_status IN ('PENDING', 'SUCCESS', 'FAILED')),
  error_message TEXT,
  UNIQUE (job_id, spotify_track_id)
);

CREATE INDEX migration_jobs_user_created_idx ON migration_jobs(user_id, created_at DESC);
CREATE INDEX job_items_job_status_idx ON job_items(job_id, match_status, export_status);
