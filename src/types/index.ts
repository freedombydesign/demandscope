// DemandScope Type Definitions

export type Mode = 'google' | 'youtube' | 'both';
export type Geo = 'CA' | 'US';
export type KeywordSource = 'google_ac' | 'youtube_ac' | 'manual';
export type CacheEndpoint = 'google_ac' | 'youtube_ac' | 'youtube_search' | 'dataforseo';

export interface Project {
  id: string;
  name: string;
  mode: Mode;
  geo: Geo;
  created_at: string;
}

export interface Keyword {
  id: string;
  project_id: string;
  keyword: string;
  source: KeywordSource;
  variant_count: number;
  opportunity_score: number | null;
  volume: number | null;
  volume_verified_at: string | null;
  yt_avg_views: number | null;
  yt_videos_last_12mo: number | null;
  yt_median_top3_views: number | null;
  created_at: string;
}

export interface CacheEntry {
  id: string;
  endpoint: CacheEndpoint;
  query_hash: string;
  query_params: Record<string, unknown>;
  response: unknown;
  fetched_at: string;
}

export interface QuotaTracking {
  id: string;
  date: string;
  youtube_units_used: number;
  dataforseo_cost_cents: number;
}

// Autocomplete response
export interface AutocompleteResult {
  suggestions: string[];
  cached: boolean;
  seed: string;
}

// YouTube search result for scoring
export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  daysSincePublish: number;
  viewVelocity: number; // views per day
}

export interface YouTubeSearchResult {
  keyword: string;
  totalResults: number;
  videos: YouTubeVideoResult[];
  cached: boolean;
}

// Opportunity score calculation inputs
export interface OpportunityScoreInputs {
  autocompleteVariants: number;
  avgTop10Views: number;
  videosLast12Months: number;
  medianTop3Views: number;
}

// DataForSEO volume result
export interface VolumeResult {
  keyword: string;
  volume: number;
  cpc: number | null;
  competition: number | null;
  verified_at: string;
}

// Expansion request
export interface ExpansionRequest {
  seeds: string[];
  mode: Mode;
  geo: Geo;
}

// Expansion result per seed
export interface ExpansionResult {
  seed: string;
  suggestions: string[];
  source: KeywordSource;
}
