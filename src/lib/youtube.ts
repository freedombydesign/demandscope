import { withCache } from './cache';
import { trackYouTubeUsage, YOUTUBE_API_COSTS, hasYouTubeQuota } from './quota';
import type { YouTubeVideoResult, YouTubeSearchResult, OpportunityScoreInputs } from '@/types';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

interface YouTubeSearchApiResponse {
  pageInfo: {
    totalResults: number;
  };
  items: Array<{
    id: { videoId: string };
    snippet: {
      title: string;
      channelTitle: string;
      publishedAt: string;
    };
  }>;
}

interface YouTubeVideosApiResponse {
  items: Array<{
    id: string;
    statistics: {
      viewCount: string;
    };
  }>;
}

/**
 * Search YouTube for a keyword and get video stats
 */
async function fetchYouTubeSearch(keyword: string): Promise<YouTubeSearchResult> {
  // Step 1: Search for videos
  const searchParams = new URLSearchParams({
    part: 'snippet',
    q: keyword,
    type: 'video',
    maxResults: '10',
    order: 'relevance',
    key: YOUTUBE_API_KEY,
  });

  const searchResponse = await fetch(`${YOUTUBE_SEARCH_URL}?${searchParams}`);
  if (!searchResponse.ok) {
    throw new Error(`YouTube search failed: ${searchResponse.status}`);
  }

  const searchData: YouTubeSearchApiResponse = await searchResponse.json();

  if (!searchData.items || searchData.items.length === 0) {
    return {
      keyword,
      totalResults: 0,
      videos: [],
      cached: false,
    };
  }

  // Step 2: Get video statistics
  const videoIds = searchData.items.map(item => item.id.videoId).join(',');
  const videosParams = new URLSearchParams({
    part: 'statistics',
    id: videoIds,
    key: YOUTUBE_API_KEY,
  });

  const videosResponse = await fetch(`${YOUTUBE_VIDEOS_URL}?${videosParams}`);
  if (!videosResponse.ok) {
    throw new Error(`YouTube videos fetch failed: ${videosResponse.status}`);
  }

  const videosData: YouTubeVideosApiResponse = await videosResponse.json();

  // Map video IDs to view counts
  const viewCounts = new Map<string, number>();
  for (const video of videosData.items) {
    viewCounts.set(video.id, parseInt(video.statistics.viewCount, 10) || 0);
  }

  // Build result with view velocity
  const now = new Date();
  const videos: YouTubeVideoResult[] = searchData.items.map(item => {
    const publishedAt = new Date(item.snippet.publishedAt);
    const daysSincePublish = Math.max(1, Math.floor((now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)));
    const viewCount = viewCounts.get(item.id.videoId) || 0;

    return {
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      viewCount,
      daysSincePublish,
      viewVelocity: Math.round(viewCount / daysSincePublish),
    };
  });

  return {
    keyword,
    totalResults: searchData.pageInfo.totalResults,
    videos,
    cached: false,
  };
}

/**
 * Search YouTube with caching and quota tracking
 */
export async function searchYouTube(keyword: string): Promise<YouTubeSearchResult> {
  // Check quota first
  const hasQuota = await hasYouTubeQuota(YOUTUBE_API_COSTS.SEARCH_LIST);
  if (!hasQuota) {
    throw new Error('YouTube API daily quota exceeded');
  }

  const result = await withCache<YouTubeSearchResult>(
    'youtube_search',
    { keyword },
    async () => {
      // Track quota usage (search.list = 100 units)
      await trackYouTubeUsage(YOUTUBE_API_COSTS.SEARCH_LIST);
      return fetchYouTubeSearch(keyword);
    }
  );

  return { ...result.data, cached: result.cached };
}

/**
 * Calculate opportunity score for a keyword
 *
 * FORMULA (v2 - demand-weighted):
 *
 * Demand signals (higher = better):
 *   - autocomplete_variants: More variants = more search demand
 *     LOW VARIANTS = LOW DEMAND = SCORE PENALTY
 *   - avg_top10_views: Higher views = more interest
 *
 * Competition signals (higher = worse):
 *   - videos_last_12mo: More recent videos = more competition
 *   - median_top3_views: Higher top views = harder to compete
 *
 * Key insight: Low competition + Low demand = BAD (dead topic)
 *              Low competition + High demand = GOOD (opportunity)
 *
 * Weights can be adjusted below:
 */
const SCORE_WEIGHTS = {
  VARIANT_WEIGHT: 8,           // Points per autocomplete variant (was 2)
  LOW_VARIANT_PENALTY: 25,     // Penalty if variants < threshold
  LOW_VARIANT_THRESHOLD: 3,    // Variants below this = penalty
  AVG_VIEWS_DIVISOR: 15000,    // Divide avg views by this
  RECENT_VIDEO_WEIGHT: 4,      // Penalty per video in last 12mo
  TOP3_VIEWS_DIVISOR: 50000,   // Divide median top3 views by this
};

export function calculateOpportunityScore(inputs: OpportunityScoreInputs): number {
  const {
    autocompleteVariants,
    avgTop10Views,
    videosLast12Months,
    medianTop3Views,
  } = inputs;

  // Demand score - variants are now heavily weighted
  const variantScore = autocompleteVariants * SCORE_WEIGHTS.VARIANT_WEIGHT;
  const viewsScore = avgTop10Views / SCORE_WEIGHTS.AVG_VIEWS_DIVISOR;
  const demand = variantScore + viewsScore;

  // Low demand penalty - if few variants, this is likely a dead topic
  const lowDemandPenalty = autocompleteVariants < SCORE_WEIGHTS.LOW_VARIANT_THRESHOLD
    ? SCORE_WEIGHTS.LOW_VARIANT_PENALTY
    : 0;

  // Competition score
  const recentCompetition = videosLast12Months * SCORE_WEIGHTS.RECENT_VIDEO_WEIGHT;
  const topChannelCompetition = medianTop3Views / SCORE_WEIGHTS.TOP3_VIEWS_DIVISOR;
  const competition = recentCompetition + topChannelCompetition;

  // Final score: demand - competition - low demand penalty
  const rawScore = 50 + (demand - competition) - lowDemandPenalty;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/**
 * Analyze YouTube search results and calculate scores
 */
export function analyzeYouTubeResults(
  searchResult: YouTubeSearchResult,
  variantCount: number
): {
  avgViews: number;
  videosLast12Mo: number;
  medianTop3Views: number;
  opportunityScore: number;
} {
  const { videos } = searchResult;

  if (videos.length === 0) {
    return {
      avgViews: 0,
      videosLast12Mo: 0,
      medianTop3Views: 0,
      opportunityScore: 75, // No competition = opportunity
    };
  }

  // Average views of all results
  const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
  const avgViews = Math.round(totalViews / videos.length);

  // Count videos published in last 12 months
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const videosLast12Mo = videos.filter(v => new Date(v.publishedAt) > oneYearAgo).length;

  // Median views of top 3
  const top3Views = videos
    .slice(0, 3)
    .map(v => v.viewCount)
    .sort((a, b) => a - b);
  const medianTop3Views = top3Views.length > 0
    ? top3Views[Math.floor(top3Views.length / 2)]
    : 0;

  // Calculate opportunity score
  const opportunityScore = calculateOpportunityScore({
    autocompleteVariants: variantCount,
    avgTop10Views: avgViews,
    videosLast12Months: videosLast12Mo,
    medianTop3Views,
  });

  return {
    avgViews,
    videosLast12Mo,
    medianTop3Views,
    opportunityScore,
  };
}
