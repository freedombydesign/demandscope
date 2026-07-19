'use client';

import { useState } from 'react';
import type { Mode, Geo } from '@/types';

interface ExpansionFormProps {
  onExpand: (seeds: string[], mode: Mode, geo: Geo) => void;
  isExpanding: boolean;
  progress?: string;
}

export default function ExpansionForm({ onExpand, isExpanding, progress }: ExpansionFormProps) {
  const [seeds, setSeeds] = useState('');
  const [mode, setMode] = useState<Mode>('both');
  const [geo, setGeo] = useState<Geo>('CA');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const seedList = seeds
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (seedList.length === 0) return;
    onExpand(seedList, mode, geo);
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
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
  );
}
