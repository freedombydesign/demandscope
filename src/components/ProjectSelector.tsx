'use client';

import { useState } from 'react';
import type { Project, Mode, Geo } from '@/types';

interface ProjectSelectorProps {
  projects: Project[];
  currentProject: Project | null;
  onSelect: (project: Project) => void;
  onCreate: (name: string, mode: Mode, geo: Geo) => void;
  onDelete: (projectId: string) => void;
  onExport: (projectId: string) => void;
}

export default function ProjectSelector({
  projects,
  currentProject,
  onSelect,
  onCreate,
  onDelete,
  onExport,
}: ProjectSelectorProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<Mode>('both');
  const [newGeo, setNewGeo] = useState<Geo>('CA');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreate(newName.trim(), newMode, newGeo);
    setNewName('');
    setShowCreate(false);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Projects</h2>
        <button
          className="btn btn-secondary text-sm"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? 'Cancel' : '+ New'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-4 p-3 bg-[var(--background)] rounded-lg space-y-3">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Project name (e.g. Say It and Stop)"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={newMode} onChange={e => setNewMode(e.target.value as Mode)}>
              <option value="both">Both</option>
              <option value="google">Google</option>
              <option value="youtube">YouTube</option>
            </select>
            <select value={newGeo} onChange={e => setNewGeo(e.target.value as Geo)}>
              <option value="CA">Canada</option>
              <option value="US">US</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-full justify-center">
            Create Project
          </button>
        </form>
      )}

      {/* Project list */}
      <div className="space-y-2">
        {projects.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No projects yet</p>
        ) : (
          projects.map(project => (
            <div
              key={project.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                currentProject?.id === project.id
                  ? 'bg-[var(--accent)] bg-opacity-20 border border-[var(--accent)]'
                  : 'bg-[var(--background)] hover:bg-[var(--card-hover)]'
              }`}
              onClick={() => onSelect(project)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{project.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {project.mode} · {project.geo}
                  </div>
                </div>
                {currentProject?.id === project.id && (
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-[var(--accent)] hover:underline"
                      onClick={e => {
                        e.stopPropagation();
                        onExport(project.id);
                      }}
                    >
                      Export
                    </button>
                    <button
                      className="text-xs text-[var(--danger)] hover:underline"
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm('Delete this project?')) {
                          onDelete(project.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
