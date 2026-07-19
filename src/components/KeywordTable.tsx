'use client';

import { useState, useMemo } from 'react';
import { generateTrendsUrl } from '@/lib/trends';
import type { Keyword, Geo } from '@/types';

interface KeywordTableProps {
  keywords: Keyword[];
  geo: Geo;
  onScore: (keywords: Keyword[]) => void;
  onVerifyVolume: (keywords: Keyword[]) => void;
  onDelete: (keywordIds: string[]) => void;
  isScoring: boolean;
  isVerifying: boolean;
}

type SortField = 'keyword' | 'opportunity_score' | 'variant_count' | 'volume';
type SortDirection = 'asc' | 'desc';

function getScoreClass(score: number | null): string {
  if (score === null) return '';
  if (score >= 70) return 'score-high';
  if (score >= 40) return 'score-medium';
  return 'score-low';
}

export default function KeywordTable({
  keywords,
  geo,
  onScore,
  onVerifyVolume,
  onDelete,
  isScoring,
  isVerifying,
}: KeywordTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('opportunity_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sort keywords
  const sortedKeywords = useMemo(() => {
    return [...keywords].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'keyword':
          aVal = a.keyword;
          bVal = b.keyword;
          break;
        case 'opportunity_score':
          aVal = a.opportunity_score ?? -1;
          bVal = b.opportunity_score ?? -1;
          break;
        case 'variant_count':
          aVal = a.variant_count;
          bVal = b.variant_count;
          break;
        case 'volume':
          aVal = a.volume ?? -1;
          bVal = b.volume ?? -1;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [keywords, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSelectAll = () => {
    if (selected.size === keywords.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(keywords.map(k => k.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const selectedKeywords = keywords.filter(k => selected.has(k.id));
  const unscoredSelected = selectedKeywords.filter(k => k.opportunity_score === null);
  const unverifiedSelected = selectedKeywords.filter(k => k.volume === null);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="opacity-30">↕</span>;
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-4 p-3 bg-[var(--card)] rounded-lg border border-[var(--border)]">
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--muted)]">
            {selected.size} of {keywords.length} selected
          </span>
          {selected.size > 0 && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => onScore(selectedKeywords)}
                disabled={isScoring || unscoredSelected.length === 0}
              >
                {isScoring ? (
                  <>
                    <span className="spinner" /> Scoring...
                  </>
                ) : (
                  `Score ${unscoredSelected.length} keywords`
                )}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onVerifyVolume(selectedKeywords)}
                disabled={isVerifying || unverifiedSelected.length === 0}
              >
                {isVerifying ? (
                  <>
                    <span className="spinner" /> Verifying...
                  </>
                ) : (
                  `Verify volume (${unverifiedSelected.length})`
                )}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  onDelete(Array.from(selected));
                  setSelected(new Set());
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-auto max-h-[600px]">
        <table>
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={selected.size === keywords.length && keywords.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th
                className="cursor-pointer hover:text-[var(--foreground)]"
                onClick={() => handleSort('keyword')}
              >
                Keyword <SortIcon field="keyword" />
              </th>
              <th className="w-20">Source</th>
              <th
                className="w-24 cursor-pointer hover:text-[var(--foreground)]"
                onClick={() => handleSort('variant_count')}
              >
                Variants <SortIcon field="variant_count" />
              </th>
              <th
                className="w-24 cursor-pointer hover:text-[var(--foreground)]"
                onClick={() => handleSort('opportunity_score')}
              >
                Score <SortIcon field="opportunity_score" />
              </th>
              <th
                className="w-24 cursor-pointer hover:text-[var(--foreground)]"
                onClick={() => handleSort('volume')}
              >
                Volume <SortIcon field="volume" />
              </th>
              <th className="w-20">Trends</th>
            </tr>
          </thead>
          <tbody>
            {sortedKeywords.map(kw => (
              <tr key={kw.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(kw.id)}
                    onChange={() => handleSelect(kw.id)}
                  />
                </td>
                <td className="font-medium">{kw.keyword}</td>
                <td>
                  <span
                    className={`badge ${
                      kw.source === 'youtube_ac' ? 'badge-youtube' : 'badge-google'
                    }`}
                  >
                    {kw.source === 'youtube_ac' ? 'YT' : 'G'}
                  </span>
                </td>
                <td>{kw.variant_count}</td>
                <td>
                  {kw.opportunity_score !== null ? (
                    <span className={`font-semibold ${getScoreClass(kw.opportunity_score)}`}>
                      {kw.opportunity_score}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td>
                  {kw.volume !== null ? (
                    kw.volume.toLocaleString()
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td>
                  <a
                    href={generateTrendsUrl(kw.keyword, geo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline text-sm"
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {keywords.length === 0 && (
          <div className="text-center py-8 text-[var(--muted)]">
            No keywords yet. Run an expansion to get started.
          </div>
        )}
      </div>
    </div>
  );
}
