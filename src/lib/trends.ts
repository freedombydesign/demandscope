import type { Geo } from '@/types';

// Google Trends geo codes
const TRENDS_GEO_CODES: Record<Geo, string> = {
  CA: 'CA',
  US: 'US',
};

/**
 * Generate a Google Trends URL for a keyword
 * Since Trends has no official API, we just generate a link the user can click
 */
export function generateTrendsUrl(keyword: string, geo: Geo): string {
  const encodedKeyword = encodeURIComponent(keyword);
  const geoCode = TRENDS_GEO_CODES[geo];
  return `https://trends.google.com/trends/explore?q=${encodedKeyword}&geo=${geoCode}`;
}

/**
 * Generate Trends comparison URL for multiple keywords (up to 5)
 */
export function generateTrendsCompareUrl(keywords: string[], geo: Geo): string {
  const limitedKeywords = keywords.slice(0, 5);
  const encodedKeywords = limitedKeywords.map(k => encodeURIComponent(k)).join(',');
  const geoCode = TRENDS_GEO_CODES[geo];
  return `https://trends.google.com/trends/explore?q=${encodedKeywords}&geo=${geoCode}`;
}
