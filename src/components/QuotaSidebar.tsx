'use client';

import { useEffect, useState } from 'react';

interface QuotaData {
  youtube: {
    dailyLimit: number;
    usedToday: number;
    remaining: number;
    percentUsed: number;
  };
  dataforseo: {
    configured: boolean;
    spentTodayDollars: string;
    spentThisMonthDollars: string;
  };
  cache: {
    totalEntries: number;
    byEndpoint: Record<string, number>;
  };
}

export default function QuotaSidebar() {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/quota');
      if (res.ok) {
        setQuota(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch quota:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
    // Refresh every 30 seconds
    const interval = setInterval(fetchQuota, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="card">
        <div className="spinner mx-auto" />
      </div>
    );
  }

  if (!quota) {
    return (
      <div className="card text-sm text-[var(--muted)]">
        Failed to load quota
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* YouTube Quota */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="badge badge-youtube">YT</span>
          YouTube API
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Used today</span>
            <span>{quota.youtube.usedToday.toLocaleString()} units</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Remaining</span>
            <span className={quota.youtube.remaining < 1000 ? 'text-[var(--warning)]' : ''}>
              {quota.youtube.remaining.toLocaleString()} units
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                quota.youtube.percentUsed > 80
                  ? 'bg-[var(--danger)]'
                  : quota.youtube.percentUsed > 50
                  ? 'bg-[var(--warning)]'
                  : 'bg-[var(--success)]'
              }`}
              style={{ width: `${quota.youtube.percentUsed}%` }}
            />
          </div>
          <p className="text-xs text-[var(--muted)]">
            {quota.youtube.percentUsed}% of 10k daily limit
          </p>
        </div>
      </div>

      {/* DataForSEO Cost */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="badge badge-google">SEO</span>
          DataForSEO
        </h3>
        {quota.dataforseo.configured ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">Today</span>
              <span>${quota.dataforseo.spentTodayDollars}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">This month</span>
              <span>${quota.dataforseo.spentThisMonthDollars}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Not configured. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to .env.local
          </p>
        )}
      </div>

      {/* Cache Stats */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3">Cache</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Total entries</span>
            <span>{quota.cache.totalEntries}</span>
          </div>
          {Object.entries(quota.cache.byEndpoint).map(([endpoint, count]) => (
            <div key={endpoint} className="flex justify-between text-xs">
              <span className="text-[var(--muted)]">{endpoint}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
