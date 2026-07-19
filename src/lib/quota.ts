import { createServerClient } from './supabase';

// YouTube Data API costs (in units)
export const YOUTUBE_API_COSTS = {
  SEARCH_LIST: 100, // search.list costs 100 units
  CHANNELS_LIST: 1,  // channels.list costs 1 unit (not used, but for reference)
};

// Daily quota limit for YouTube Data API
export const YOUTUBE_DAILY_QUOTA = 10000;

// DataForSEO costs (approximate, in cents per keyword)
export const DATAFORSEO_COST_PER_KEYWORD = 0.1; // $0.001 per keyword for Google Ads volume

/**
 * Get today's quota usage
 */
export async function getTodayQuota(): Promise<{
  youtubeUnitsUsed: number;
  youtubeUnitsRemaining: number;
  dataforseoSpentCents: number;
}> {
  const supabase = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('ds_quota_tracking')
    .select('youtube_units_used, dataforseo_cost_cents')
    .eq('date', today)
    .single();

  if (error || !data) {
    return {
      youtubeUnitsUsed: 0,
      youtubeUnitsRemaining: YOUTUBE_DAILY_QUOTA,
      dataforseoSpentCents: 0,
    };
  }

  return {
    youtubeUnitsUsed: data.youtube_units_used,
    youtubeUnitsRemaining: YOUTUBE_DAILY_QUOTA - data.youtube_units_used,
    dataforseoSpentCents: data.dataforseo_cost_cents,
  };
}

/**
 * Get this month's DataForSEO spend
 */
export async function getMonthlyDataForSEOSpend(): Promise<number> {
  const supabase = createServerClient();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const { data, error } = await supabase
    .from('ds_quota_tracking')
    .select('dataforseo_cost_cents')
    .gte('date', firstOfMonth);

  if (error || !data) {
    return 0;
  }

  return data.reduce((sum, row) => sum + row.dataforseo_cost_cents, 0);
}

/**
 * Increment YouTube quota usage
 */
export async function trackYouTubeUsage(units: number): Promise<void> {
  const supabase = createServerClient();

  // Call the database function
  await supabase.rpc('ds_increment_youtube_quota', { units });
}

/**
 * Increment DataForSEO cost
 */
export async function trackDataForSEOCost(cents: number): Promise<void> {
  const supabase = createServerClient();

  await supabase.rpc('ds_increment_dataforseo_cost', { cents });
}

/**
 * Check if we have enough YouTube quota for an operation
 */
export async function hasYouTubeQuota(unitsNeeded: number): Promise<boolean> {
  const { youtubeUnitsRemaining } = await getTodayQuota();
  return youtubeUnitsRemaining >= unitsNeeded;
}

/**
 * Estimate DataForSEO cost for a batch of keywords
 */
export function estimateDataForSEOCost(keywordCount: number): {
  cents: number;
  dollars: string;
} {
  const cents = Math.ceil(keywordCount * DATAFORSEO_COST_PER_KEYWORD);
  return {
    cents,
    dollars: (cents / 100).toFixed(2),
  };
}
