import { NextRequest, NextResponse } from 'next/server';
import { expandKeyword, getSource } from '@/lib/autocomplete';
import type { Geo, Mode } from '@/types';

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

    // Merge and dedupe all suggestions
    const allSuggestions = new Set<string>();
    for (const result of results) {
      for (const suggestion of result.suggestions) {
        allSuggestions.add(suggestion);
      }
    }

    return NextResponse.json({
      results,
      totalUnique: allSuggestions.size,
      allSuggestions: Array.from(allSuggestions).sort(),
    });
  } catch (error) {
    console.error('Expand error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Expansion failed' },
      { status: 500 }
    );
  }
}
