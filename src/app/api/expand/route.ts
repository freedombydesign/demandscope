import { NextRequest, NextResponse } from 'next/server';
import { expandKeyword, getSource } from '@/lib/autocomplete';
import type { Geo, Mode } from '@/types';

// Extend timeout for this route (Vercel Pro: up to 300s, Hobby: 10s max)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seeds, mode, geo } = body as {
      seeds: string[];
      mode: Mode;
      geo: Geo;
    };

    if (!seeds || !Array.isArray(seeds) || seeds.length === 0) {
      return NextResponse.json(
        { error: 'Seeds array is required' },
        { status: 400 }
      );
    }

    const results: Array<{
      seed: string;
      source: string;
      suggestions: string[];
      variantCount: number;
      cachedCount: number;
      fetchedCount: number;
    }> = [];

    // Process each seed
    for (const seed of seeds) {
      const cleanSeed = seed.trim().toLowerCase();
      if (!cleanSeed) continue;

      // Expand for Google
      if (mode === 'google' || mode === 'both') {
        const result = await expandKeyword(cleanSeed, geo, false);
        results.push({
          seed: cleanSeed,
          source: getSource(false),
          suggestions: result.suggestions,
          variantCount: result.variantCount,
          cachedCount: result.cachedCount,
          fetchedCount: result.fetchedCount,
        });
      }

      // Expand for YouTube
      if (mode === 'youtube' || mode === 'both') {
        const result = await expandKeyword(cleanSeed, geo, true);
        results.push({
          seed: cleanSeed,
          source: getSource(true),
          suggestions: result.suggestions,
          variantCount: result.variantCount,
          cachedCount: result.cachedCount,
          fetchedCount: result.fetchedCount,
        });
      }
    }

    // Merge and count how many times each keyword appears (demand signal)
    const keywordCounts = new Map<string, number>();
    for (const result of results) {
      for (const suggestion of result.suggestions) {
        keywordCounts.set(suggestion, (keywordCounts.get(suggestion) || 0) + 1);
      }
    }

    // Convert to array with counts
    const keywordsWithCounts = Array.from(keywordCounts.entries())
      .map(([keyword, count]) => ({ keyword, variant_count: count }))
      .sort((a, b) => b.variant_count - a.variant_count); // Sort by count desc

    return NextResponse.json({
      results,
      totalUnique: keywordCounts.size,
      allSuggestions: keywordsWithCounts.map(k => k.keyword), // For backwards compat
      keywordsWithCounts, // New field with counts
    });
  } catch (error) {
    console.error('Expand error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Expansion failed' },
      { status: 500 }
    );
  }
}
