import { withCache } from './cache';
import { trackDataForSEOCost, estimateDataForSEOCost } from './quota';
import type { VolumeResult, Geo } from '@/types';

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;
const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live';

// Location codes for DataForSEO
const LOCATION_CODES: Record<Geo, number> = {
  CA: 2124, // Canada
  US: 2840, // United States
};

interface DataForSEOKeywordResult {
  keyword: string;
  search_volume: number;
  cpc: number | null;
  competition: number | null;
}

interface DataForSEOResponse {
  tasks: Array<{
    result: Array<{
      keyword: string;
      search_volume: number;
      cpc: number | null;
      competition: number | null;
    }>;
  }>;
}

/**
 * Check if DataForSEO credentials are configured
 */
export function isDataForSEOConfigured(): boolean {
  return !!(DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD);
}

/**
 * Fetch search volume from DataForSEO
 */
async function fetchVolume(
  keywords: string[],
  geo: Geo
): Promise<Map<string, DataForSEOKeywordResult>> {
  if (!isDataForSEOConfigured()) {
    throw new Error('DataForSEO credentials not configured');
  }

  const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

  const body = [
    {
      keywords,
      location_code: LOCATION_CODES[geo],
      language_code: 'en',
    },
  ];

  const response = await fetch(DATAFORSEO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DataForSEO API error: ${response.status} - ${error}`);
  }

  const data: DataForSEOResponse = await response.json();

  // Parse results into map
  const results = new Map<string, DataForSEOKeywordResult>();

  if (data.tasks && data.tasks[0] && data.tasks[0].result) {
    for (const item of data.tasks[0].result) {
      results.set(item.keyword.toLowerCase(), {
        keyword: item.keyword,
        search_volume: item.search_volume || 0,
        cpc: item.cpc,
        competition: item.competition,
      });
    }
  }

  return results;
}

/**
 * Get search volume for keywords with caching
 * Batches up to 100 keywords per request (DataForSEO limit)
 */
export async function getSearchVolume(
  keywords: string[],
  geo: Geo
): Promise<VolumeResult[]> {
  const results: VolumeResult[] = [];
  const uncachedKeywords: string[] = [];

  // Check cache for each keyword
  for (const keyword of keywords) {
    const cached = await withCache<VolumeResult | null>(
      'dataforseo',
      { keyword: keyword.toLowerCase(), geo },
      async () => null // This won't be called if cached
    );

    if (cached.cached && cached.data) {
      results.push(cached.data);
    } else {
      uncachedKeywords.push(keyword);
    }
  }

  // Fetch uncached keywords in batches of 100
  if (uncachedKeywords.length > 0) {
    const batches: string[][] = [];
    for (let i = 0; i < uncachedKeywords.length; i += 100) {
      batches.push(uncachedKeywords.slice(i, i + 100));
    }

    for (const batch of batches) {
      const volumeData = await fetchVolume(batch, geo);

      // Track cost
      const cost = estimateDataForSEOCost(batch.length);
      await trackDataForSEOCost(cost.cents);

      // Store results and cache them
      for (const keyword of batch) {
        const data = volumeData.get(keyword.toLowerCase());
        const result: VolumeResult = {
          keyword,
          volume: data?.search_volume || 0,
          cpc: data?.cpc || null,
          competition: data?.competition || null,
          verified_at: new Date().toISOString(),
        };

        results.push(result);

        // Cache the result
        await withCache<VolumeResult>(
          'dataforseo',
          { keyword: keyword.toLowerCase(), geo },
          async () => result
        );
      }
    }
  }

  return results;
}

/**
 * Preview cost before fetching volume
 */
export async function previewVolumeCost(
  keywords: string[],
  geo: Geo
): Promise<{
  totalKeywords: number;
  cachedKeywords: number;
  uncachedKeywords: number;
  estimatedCostCents: number;
  estimatedCostDollars: string;
}> {
  let cachedCount = 0;

  for (const keyword of keywords) {
    const cached = await withCache<VolumeResult | null>(
      'dataforseo',
      { keyword: keyword.toLowerCase(), geo },
      async () => null
    );
    if (cached.cached) {
      cachedCount++;
    }
  }

  const uncachedCount = keywords.length - cachedCount;
  const cost = estimateDataForSEOCost(uncachedCount);

  return {
    totalKeywords: keywords.length,
    cachedKeywords: cachedCount,
    uncachedKeywords: uncachedCount,
    estimatedCostCents: cost.cents,
    estimatedCostDollars: cost.dollars,
  };
}
