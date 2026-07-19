'use client';

import { useState, useEffect, useCallback } from 'react';
import QuotaSidebar from '@/components/QuotaSidebar';
import ProjectSelector from '@/components/ProjectSelector';
import ExpansionForm from '@/components/ExpansionForm';
import KeywordTable from '@/components/KeywordTable';
import type { Project, Keyword, Mode, Geo } from '@/types';

export default function Home() {
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);

  // Action states
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandProgress, setExpandProgress] = useState('');
  const [isScoring, setIsScoring] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load project keywords
  const loadProjectKeywords = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || []);
      }
    } catch (e) {
      console.error('Failed to load keywords:', e);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (currentProject) {
      loadProjectKeywords(currentProject.id);
    } else {
      setKeywords([]);
    }
  }, [currentProject, loadProjectKeywords]);

  // Create project
  const handleCreateProject = async (name: string, mode: Mode, geo: Geo) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name, mode, geo }),
      });
      if (res.ok) {
        const project = await res.json();
        setProjects(prev => [project, ...prev]);
        setCurrentProject(project);
      }
    } catch (e) {
      console.error('Failed to create project:', e);
    }
  };

  // Delete project
  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects?id=${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (currentProject?.id === projectId) {
          setCurrentProject(null);
        }
      }
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  };

  // Export project
  const handleExportProject = async (projectId: string) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export', projectId }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `keywords_${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Failed to export:', e);
    }
  };

  // Expand keywords
  const handleExpand = async (seeds: string[], mode: Mode, geo: Geo) => {
    if (!currentProject) {
      alert('Please create or select a project first');
      return;
    }

    setIsExpanding(true);
    setExpandProgress(`Expanding ${seeds.length} seed(s)...`);

    try {
      const res = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds, mode, geo }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Expansion failed');
      }

      const data = await res.json();
      setExpandProgress(`Found ${data.totalUnique} unique keywords. Saving...`);

      // Add keywords to project
      const keywordsToAdd = data.allSuggestions.map((kw: string) => ({
        keyword: kw,
        source: mode === 'youtube' ? 'youtube_ac' : 'google_ac',
        variant_count: 1, // Will be updated with actual count
      }));

      const addRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-keywords',
          projectId: currentProject.id,
          keywords: keywordsToAdd,
        }),
      });

      if (addRes.ok) {
        await loadProjectKeywords(currentProject.id);
      }
    } catch (e) {
      console.error('Expansion failed:', e);
      alert(e instanceof Error ? e.message : 'Expansion failed');
    } finally {
      setIsExpanding(false);
      setExpandProgress('');
    }
  };

  // Score keywords (YouTube API)
  const handleScore = async (keywordsToScore: Keyword[]) => {
    setIsScoring(true);
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywordsToScore.map(k => ({
            id: k.id,
            keyword: k.keyword,
            variant_count: k.variant_count,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Scoring failed');
      }

      // Reload keywords
      if (currentProject) {
        await loadProjectKeywords(currentProject.id);
      }
    } catch (e) {
      console.error('Scoring failed:', e);
      alert(e instanceof Error ? e.message : 'Scoring failed');
    } finally {
      setIsScoring(false);
    }
  };

  // Verify volume (DataForSEO)
  const handleVerifyVolume = async (keywordsToVerify: Keyword[]) => {
    if (!currentProject) return;

    // First preview cost
    try {
      const previewRes = await fetch('/api/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          keywords: keywordsToVerify.map(k => ({ id: k.id, keyword: k.keyword })),
          geo: currentProject.geo,
        }),
      });

      if (!previewRes.ok) {
        const error = await previewRes.json();
        throw new Error(error.error || 'Preview failed');
      }

      const preview = await previewRes.json();

      if (preview.uncachedKeywords === 0) {
        alert('All keywords already have cached volume data');
        return;
      }

      const confirm = window.confirm(
        `This will verify ${preview.uncachedKeywords} keywords (${preview.cachedKeywords} cached).\n\nEstimated cost: $${preview.estimatedCostDollars}\n\nProceed?`
      );

      if (!confirm) return;

      setIsVerifying(true);

      const verifyRes = await fetch('/api/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          keywords: keywordsToVerify.map(k => ({ id: k.id, keyword: k.keyword })),
          geo: currentProject.geo,
        }),
      });

      if (!verifyRes.ok) {
        const error = await verifyRes.json();
        throw new Error(error.error || 'Verification failed');
      }

      // Reload keywords
      await loadProjectKeywords(currentProject.id);
    } catch (e) {
      console.error('Volume verification failed:', e);
      alert(e instanceof Error ? e.message : 'Volume verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Delete keywords
  const handleDeleteKeywords = async (keywordIds: string[]) => {
    try {
      const res = await fetch('/api/keywords', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: keywordIds }),
      });

      if (res.ok && currentProject) {
        await loadProjectKeywords(currentProject.id);
      }
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold">DemandScope</h1>
          <p className="text-[var(--muted)]">Keyword research for content validation</p>
        </header>

        {/* Main layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-3 space-y-6">
            <ProjectSelector
              projects={projects}
              currentProject={currentProject}
              onSelect={setCurrentProject}
              onCreate={handleCreateProject}
              onDelete={handleDeleteProject}
              onExport={handleExportProject}
            />
            <QuotaSidebar />
          </div>

          {/* Main content */}
          <div className="col-span-9 space-y-6">
            {currentProject ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{currentProject.name}</h2>
                    <p className="text-sm text-[var(--muted)]">
                      {currentProject.mode} · {currentProject.geo} · {keywords.length} keywords
                    </p>
                  </div>
                </div>

                <ExpansionForm
                  onExpand={handleExpand}
                  isExpanding={isExpanding}
                  progress={expandProgress}
                />

                <KeywordTable
                  keywords={keywords}
                  geo={currentProject.geo}
                  onScore={handleScore}
                  onVerifyVolume={handleVerifyVolume}
                  onDelete={handleDeleteKeywords}
                  isScoring={isScoring}
                  isVerifying={isVerifying}
                />
              </>
            ) : (
              <div className="card text-center py-16">
                <h2 className="text-xl font-semibold mb-2">No Project Selected</h2>
                <p className="text-[var(--muted)]">
                  Create a new project or select an existing one to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
