import { withCache } from './cache';
import type { Geo, KeywordSource } from '@/types';

// Expanded question modifiers for better coverage
const QUESTION_MODIFIERS = [
  'how', 'why', 'can', 'best', 'vs', 'for',
  'what', 'when', 'where', 'which', 'does', 'is', 'without', 'with'
];

// A-Z letters for expansion
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

// Rate limit: 100-200ms randomized delay between requests
function randomDelay(): Promise<void> {
  const ms = 100 + Math.random() * 100;
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Geo code mapping
const GEO_CODES: Record<Geo, string> = {
  CA: 'ca',
  US: 'us',
};

interface AutocompleteParams {
  query: string;
  geo: Geo;
  isYouTube: boolean;
}

/**
 * Fetch autocomplete suggestions from Google/YouTube
 */
async function fetchAutocomplete(params: AutocompleteParams): Promise<string[]> {
  const { query, geo, isYouTube } = params;

  // Build URL
  const baseUrl = 'https://suggestqueries.google.com/complete/search';
  const urlParams = new URLSearchParams({
    client: 'firefox',
    q: query,
    gl: GEO_CODES[geo],
    hl: 'en',
  });

  if (isYouTube) {
    urlParams.set('ds', 'yt');
  }

  const url = `${baseUrl}?${urlParams.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Autocomplete failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    // Response format: ["query", ["suggestion1", "suggestion2", ...]]
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1] as string[];
    }
    return [];
  } catch (error) {
    console.error('Autocomplete error:', error);
    return [];
  }
}

/**
 * Fetch autocomplete with caching
 */
async function getCachedAutocomplete(
  query: string,
  geo: Geo,
  isYouTube: boolean
): Promise<{ suggestions: string[]; cached: boolean }> {
  const endpoint = isYouTube ? 'youtube_ac' : 'google_ac';
  const params = { query, geo };

  const result = await withCache<string[]>(
    endpoint,
    params,
    () => fetchAutocomplete({ query, geo, isYouTube })
  );

  return { suggestions: result.data, cached: result.cached };
}

/**
 * Generate all expansion queries for a seed keyword
 */
function generateExpansionQueries(seed: string): string[] {
  const queries: string[] = [seed]; // Start with the seed itself

  // A-Z expansions: "seed a", "seed b", etc.
  for (const letter of ALPHABET) {
    queries.push(`${seed} ${letter}`);
  }

  // Question modifier expansions: "how seed", "why seed", etc.
  for (const modifier of QUESTION_MODIFIERS) {
    queries.push(`${modifier} ${seed}`);
  }

  return queries;
}

export interface ExpansionProgress {
  seed: string;
  completed: number;
  total: number;
  currentQuery: string;
}

/**
 * Expand a seed keyword using autocomplete
 * Returns deduplicated suggestions with variant count
 */
export async function expandKeyword(
  seed: string,
  geo: Geo,
  isYouTube: boolean,
  onProgress?: (progress: ExpansionProgress) => void
): Promise<{
  suggestions: string[];
  variantCount: number;
  cachedCount: number;
  fetchedCount: number;
}> {
  const queries = generateExpansionQueries(seed);
  const allSuggestions = new Set<string>();
  let cachedCount = 0;
  let fetchedCount = 0;

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    // Report progress
    onProgress?.({
      seed,
      completed: i,
      total: queries.length,
      currentQuery: query,
    });

    const { suggestions, cached } = await getCachedAutocomplete(query, geo, isYouTube);

    if (cached) {
      cachedCount++;
    } else {
      fetchedCount++;
      // Rate limit only for non-cached requests
      await randomDelay();
    }

    // Add all suggestions to set (deduplication)
    for (const suggestion of suggestions) {
      allSuggestions.add(suggestion.toLowerCase().trim());
    }
  }

  // Final progress update
  onProgress?.({
    seed,
    completed: queries.length,
    total: queries.length,
    currentQuery: 'done',
  });

  const sortedSuggestions = Array.from(allSuggestions).sort();

  return {
    suggestions: sortedSuggestions,
    variantCount: sortedSuggestions.length,
    cachedCount,
    fetchedCount,
  };
}

/**
 * Expand multiple seeds (for batch processing)
 */
export async function expandMultipleKeywords(
  seeds: string[],
  geo: Geo,
  isYouTube: boolean,
  onProgress?: (seedIndex: number, progress: ExpansionProgress) => void
): Promise<Map<string, { suggestions: string[]; variantCount: number }>> {
  const results = new Map<string, { suggestions: string[]; variantCount: number }>();

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    const result = await expandKeyword(
      seed,
      geo,
      isYouTube,
      (progress) => onProgress?.(i, progress)
    );
    results.set(seed, {
      suggestions: result.suggestions,
      variantCount: result.variantCount,
    });
  }

  return results;
}

/**
 * Get source type based on whether it's YouTube
 */
export function getSource(isYouTube: boolean): KeywordSource {
  return isYouTube ? 'youtube_ac' : 'google_ac';
}
