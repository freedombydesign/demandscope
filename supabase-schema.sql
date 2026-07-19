-- DemandScope Schema
-- Run this in Supabase SQL Editor to create tables

-- Projects table: named keyword research projects
CREATE TABLE IF NOT EXISTS ds_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('google', 'youtube', 'both')),
  geo TEXT NOT NULL DEFAULT 'CA' CHECK (geo IN ('CA', 'US')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keywords table: individual keywords with scores
CREATE TABLE IF NOT EXISTS ds_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES ds_projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('google_ac', 'youtube_ac', 'manual')),
  variant_count INTEGER DEFAULT 0,
  opportunity_score INTEGER, -- 0-100, nullable until scored
  volume INTEGER, -- from DataForSEO, nullable
  volume_verified_at TIMESTAMPTZ,
  yt_avg_views INTEGER, -- avg views of top 10 results
  yt_videos_last_12mo INTEGER, -- competition signal
  yt_median_top3_views INTEGER, -- competition signal
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, keyword)
);

-- API cache table: cache all external API responses
CREATE TABLE IF NOT EXISTS ds_api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL, -- 'google_ac', 'youtube_ac', 'youtube_search', 'dataforseo'
  query_hash TEXT NOT NULL, -- MD5 of query params for deduplication
  query_params JSONB NOT NULL, -- original query params for debugging
  response JSONB NOT NULL, -- full API response
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(endpoint, query_hash)
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_ds_api_cache_lookup ON ds_api_cache(endpoint, query_hash);
CREATE INDEX IF NOT EXISTS idx_ds_api_cache_fetched ON ds_api_cache(fetched_at);

-- Index for keyword lookups
CREATE INDEX IF NOT EXISTS idx_ds_keywords_project ON ds_keywords(project_id);
CREATE INDEX IF NOT EXISTS idx_ds_keywords_score ON ds_keywords(opportunity_score DESC NULLS LAST);

-- Quota tracking table: track API usage
CREATE TABLE IF NOT EXISTS ds_quota_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  youtube_units_used INTEGER NOT NULL DEFAULT 0,
  dataforseo_cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date)
);

-- Function to increment YouTube quota
CREATE OR REPLACE FUNCTION ds_increment_youtube_quota(units INTEGER)
RETURNS void AS $$
BEGIN
  INSERT INTO ds_quota_tracking (date, youtube_units_used)
  VALUES (CURRENT_DATE, units)
  ON CONFLICT (date)
  DO UPDATE SET youtube_units_used = ds_quota_tracking.youtube_units_used + units;
END;
$$ LANGUAGE plpgsql;

-- Function to increment DataForSEO cost
CREATE OR REPLACE FUNCTION ds_increment_dataforseo_cost(cents INTEGER)
RETURNS void AS $$
BEGIN
  INSERT INTO ds_quota_tracking (date, dataforseo_cost_cents)
  VALUES (CURRENT_DATE, cents)
  ON CONFLICT (date)
  DO UPDATE SET dataforseo_cost_cents = ds_quota_tracking.dataforseo_cost_cents + cents;
END;
$$ LANGUAGE plpgsql;

-- Disable RLS for single-user tool (enable later if adding auth)
ALTER TABLE ds_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ds_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE ds_api_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ds_quota_tracking ENABLE ROW LEVEL SECURITY;

-- Permissive policies for single-user (all operations allowed)
CREATE POLICY "Allow all on ds_projects" ON ds_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ds_keywords" ON ds_keywords FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ds_api_cache" ON ds_api_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ds_quota_tracking" ON ds_quota_tracking FOR ALL USING (true) WITH CHECK (true);
