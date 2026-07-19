import { NextRequest, NextResponse } from 'next/server';
import { getSearchVolume, previewVolumeCost, isDataForSEOConfigured } from '@/lib/dataforseo';
import { updateKeywordVolume } from '@/lib/projects';
import type { Geo } from '@/types';

// GET /api/volume - Check if DataForSEO is configured
export async function GET() {
  return NextResponse.json({
    configured: isDataForSEOConfigured(),
  });
}

// POST /api/volume - Get search volume for keywords
export async function POST(request: NextRequest) {
  try {
    if (!isDataForSEOConfigured()) {
      return NextResponse.json(
        { error: 'DataForSEO credentials not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, keywords, geo } = body as {
      action: 'preview' | 'verify';
      keywords: Array<{ id: string; keyword: string }>;
      geo: Geo;
    };

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      );
    }

    const keywordTexts = keywords.map(k => k.keyword);

    // Preview cost only
    if (action === 'preview') {
      const preview = await previewVolumeCost(keywordTexts, geo);
      return NextResponse.json(preview);
    }

    // Verify = actually fetch volume
    if (action === 'verify') {
      const volumeResults = await getSearchVolume(keywordTexts, geo);

      // Build map for updating
      const volumeMap = new Map(
        volumeResults.map(v => [v.keyword.toLowerCase(), v.volume])
      );

      // Update each keyword in database
      const results: Array<{
        id: string;
        keyword: string;
        volume: number;
      }> = [];

      for (const kw of keywords) {
        const volume = volumeMap.get(kw.keyword.toLowerCase()) || 0;
        await updateKeywordVolume(kw.id, volume);
        results.push({
          id: kw.id,
          keyword: kw.keyword,
          volume,
        });
      }

      return NextResponse.json({
        verified: results.length,
        results,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "preview" or "verify"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Volume error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Volume check failed' },
      { status: 500 }
    );
  }
}
