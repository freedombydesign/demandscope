import { NextResponse } from 'next/server';
import { getTodayQuota, getMonthlyDataForSEOSpend, YOUTUBE_DAILY_QUOTA } from '@/lib/quota';
import { getCacheStats } from '@/lib/cache';
import { isDataForSEOConfigured } from '@/lib/dataforseo';

// GET /api/quota - Get quota and cost information
export async function GET() {
  try {
    const [quota, monthlySpend, cacheStats] = await Promise.all([
      getTodayQuota(),
      getMonthlyDataForSEOSpend(),
      getCacheStats(),
    ]);

    return NextResponse.json({
      youtube: {
        dailyLimit: YOUTUBE_DAILY_QUOTA,
        usedToday: quota.youtubeUnitsUsed,
        remaining: quota.youtubeUnitsRemaining,
        percentUsed: Math.round((quota.youtubeUnitsUsed / YOUTUBE_DAILY_QUOTA) * 100),
      },
      dataforseo: {
        configured: isDataForSEOConfigured(),
        spentTodayCents: quota.dataforseoSpentCents,
        spentTodayDollars: (quota.dataforseoSpentCents / 100).toFixed(2),
        spentThisMonthCents: monthlySpend,
        spentThisMonthDollars: (monthlySpend / 100).toFixed(2),
      },
      cache: cacheStats,
    });
  } catch (error) {
    console.error('Quota error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get quota' },
      { status: 500 }
    );
  }
}
