import { createServerClient } from './supabase';
import type { CacheEndpoint } from '@/types';
import crypto from 'crypto';

// Cache TTLs in days
const CACHE_TTLS: Record<CacheEndpoint, number> = {
  google_ac: 7,      // Autocomplete: 7 days
  youtube_ac: 7,     // Autocomplete: 7 days
  youtube_search: 30, // YouTube search: 30 days
  dataforseo: 90,    // Volume data: 90 days
};

/**
 * Generate MD5 hash of query params for cache key
 */
function hashQuery(params: Record<string, unknown>): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash('md5').update(sorted).digest('hex');
}

/**
 * Check if cached entry is still valid based on TTL
 */
function isExpired(fetchedAt: string, endpoint: CacheEndpoint): boolean {
  const ttlDays = CACHE_TTLS[endpoint];
  const fetchedDate = new Date(fetchedAt);
  const expiryDate = new Date(fetchedDate.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  return new Date() > expiryDate;
}

/**
 * Get cached response if available and not expired
 */
export async function getCached<T>(
  endpoint: CacheEndpoint,
  params: Record<string, unknown>
): Promise<{ data: T; cached: true } | null> {
  const supabase = createServerClient();
  const queryHash = hashQuery(params);

  const { data, error } = await supabase
    .from('ds_api_cache')
    .select('response, fetched_at')
    .eq('endpoint', endpoint)
    .eq('query_hash', queryHash)
    .single();

  if (error || !data) {
    return null;
  }

  if (isExpired(data.fetched_at, endpoint)) {
    // Cache expired, delete it
    await supabase
      .from('ds_api_cache')
      .delete()
      .eq('endpoint', endpoint)
      .eq('query_hash', queryHash);
    return null;
  }

  return { data: data.response as T, cached: true };
}

/**
 * Store response in cache
 */
export async function setCache(
  endpoint: CacheEndpoint,
  params: Record<string, unknown>,
  response: unknown
): Promise<void> {
  const supabase = createServerClient();
  const queryHash = hashQuery(params);

  await supabase.from('ds_api_cache').upsert(
    {
      endpoint,
      query_hash: queryHash,
      query_params: params,
      response,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint,query_hash' }
  );
}

/**
 * Wrapper that checks cache before making API call
 */
export async function withCache<T>(
  endpoint: CacheEndpoint,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>
): Promise<{ data: T; cached: boolean }> {
  // Check cache first
  const cached = await getCached<T>(endpoint, params);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache
  await setCache(endpoint, params, data);

  return { data, cached: false };
}

/**
 * Get cache stats for debugging
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  byEndpoint: Record<string, number>;
}> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('ds_api_cache')
    .select('endpoint');

  if (error || !data) {
    return { totalEntries: 0, byEndpoint: {} };
  }

  const byEndpoint: Record<string, number> = {};
  for (const entry of data) {
    byEndpoint[entry.endpoint] = (byEndpoint[entry.endpoint] || 0) + 1;
  }

  return {
    totalEntries: data.length,
    byEndpoint,
  };
}
