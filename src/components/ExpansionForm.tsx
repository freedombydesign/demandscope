'use client';

import { useState } from 'react';
import type { Mode, Geo } from '@/types';

type EntryMode = 'expand' | 'manual';

interface ExpansionFormProps {
  onExpand: (seeds: string[], mode: Mode, geo: Geo) => void;
  onManualAdd: (keywords: string[]) => void;
  isExpanding: boolean;
  progress?: string;
}

export default function ExpansionForm({ onExpand, onManualAdd, isExpanding, progress }: ExpansionFormProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>('expand');
  const [seeds, setSeeds] = useState('');
  const [manualKeywords, setManualKeywords] = useState('');
  const [mode, setMode] = useState<Mode>('both');
  const [geo, setGeo] = useState<Geo>('CA');

  const handleExpand = (e: React.FormEvent) => {
    e.preventDefault();
    const seedList = seeds
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (seedList.length === 0) return;
    onExpand(seedList, mode, geo);
    setSeeds('');
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const keywordList = manualKeywords
      .split('\n')
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0);

    if (keywordList.length === 0) return;
    onManualAdd(keywordList);
    setManualKeywords('');
  };

  return (
    <div className="card space-y-4">
      {/* Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            entryMode === 'expand'
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
          onClick={() => setEntryMode('expand')}
        >
          Expand Seeds
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            entryMode === 'manual'
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
          onClick={() => setEntryMode('manual')}
        >
          Add Manual
        </button>
      </div>

      {entryMode === 'expand' ? (
        <form onSubmit={handleExpand} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Seed Keywords</label>
            <textarea
              value={seeds}
              onChange={e => setSeeds(e.target.value)}
              placeholder="Enter one keyword per line&#10;e.g.&#10;ai receptionist&#10;how to stop overtalking"
              rows={4}
              className="resize-none"
              disabled={isExpanding}
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              One keyword per line. Each seed will be expanded with A-Z + question modifiers.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Mode</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as Mode)}
                disabled={isExpanding}
              >
                <option value="both">Both (Google + YouTube)</option>
                <option value="google">Google only</option>
                <option value="youtube">YouTube only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Region</label>
              <select
                value={geo}
                onChange={e => setGeo(e.target.value as Geo)}
                disabled={isExpanding}
              >
                <option value="CA">Canada</option>
                <option value="US">United States</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full justify-center"
            disabled={isExpanding || seeds.trim().length === 0}
          >
            {isExpanding ? (
              <>
                <span className="spinner" />
                {progress || 'Expanding...'}
              </>
            ) : (
              'Expand Keywords'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleManualAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Keywords</label>
            <textarea
              value={manualKeywords}
              onChange={e => setManualKeywords(e.target.value)}
              placeholder="Enter keywords to add (one per line)&#10;e.g.&#10;how to close a sales call&#10;best cold calling scripts&#10;sales objection handling"
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              Paste your keywords directly. They will be added without expansion.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full justify-center"
            disabled={manualKeywords.trim().length === 0}
          >
            Add Keywords
          </button>
        </form>
      )}
    </div>
  );
}
