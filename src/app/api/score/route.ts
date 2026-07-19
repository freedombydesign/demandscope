import { NextRequest, NextResponse } from 'next/server';
import { searchYouTube, analyzeYouTubeResults } from '@/lib/youtube';
import { updateKeywordScores } from '@/lib/projects';
import { getTodayQuota, YOUTUBE_API_COSTS } from '@/lib/quota';

// POST /api/score - Score keywords using YouTube API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywords } = body as {
      keywords: Array<{
        id: string;
        keyword: string;
        variant_count: number;
      }>;
    };

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      );
    }

    // Check quota before starting
    const quota = await getTodayQuota();
    const unitsNeeded = keywords.length * YOUTUBE_API_COSTS.SEARCH_LIST;

    if (quota.youtubeUnitsRemaining < unitsNeeded) {
      return NextResponse.json(
        {
          error: 'Insufficient YouTube API quota',
          unitsNeeded,
          unitsRemaining: quota.youtubeUnitsRemaining,
        },
        { status: 429 }
      );
    }

    const results: Array<{
      id: string;
      keyword: string;
      opportunityScore: number;
      avgViews: number;
      videosLast12Mo: number;
      medianTop3Views: number;
      cached: boolean;
    }> = [];

    // Score each keyword
    for (const kw of keywords) {
      try {
        const searchResult = await searchYouTube(kw.keyword);
        const analysis = analyzeYouTubeResults(searchResult, kw.variant_count);

        // Update in database
        await updateKeywordScores(kw.id, {
          opportunity_score: analysis.opportunityScore,
          yt_avg_views: analysis.avgViews,
          yt_videos_last_12mo: analysis.videosLast12Mo,
          yt_median_top3_views: analysis.medianTop3Views,
        });

        results.push({
          id: kw.id,
          keyword: kw.keyword,
          opportunityScore: analysis.opportunityScore,
          avgViews: analysis.avgViews,
          videosLast12Mo: analysis.videosLast12Mo,
          medianTop3Views: analysis.medianTop3Views,
          cached: searchResult.cached,
        });
      } catch (error) {
        console.error(`Failed to score "${kw.keyword}":`, error);
        // Continue with other keywords
      }
    }

    // Get updated quota
    const updatedQuota = await getTodayQuota();

    return NextResponse.json({
      scored: results.length,
      results,
      quota: {
        used: updatedQuota.youtubeUnitsUsed,
        remaining: updatedQuota.youtubeUnitsRemaining,
      },
    });
  } catch (error) {
    console.error('Score error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scoring failed' },
      { status: 500 }
    );
  }
}
