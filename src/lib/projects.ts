import { createServerClient } from './supabase';
import type { Project, Keyword, Mode, Geo, KeywordSource } from '@/types';

/**
 * Create a new project
 */
export async function createProject(
  name: string,
  mode: Mode,
  geo: Geo
): Promise<Project> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('ds_projects')
    .insert({ name, mode, geo })
    .select()
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return data;
}

/**
 * Get all projects
 */
export async function getProjects(): Promise<Project[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('ds_projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get projects: ${error.message}`);
  return data || [];
}

/**
 * Get a single project with its keywords
 */
export async function getProject(id: string): Promise<Project & { keywords: Keyword[] }> {
  const supabase = createServerClient();

  const { data: project, error: projectError } = await supabase
    .from('ds_projects')
    .select('*')
    .eq('id', id)
    .single();

  if (projectError) throw new Error(`Failed to get project: ${projectError.message}`);

  const { data: keywords, error: keywordsError } = await supabase
    .from('ds_keywords')
    .select('*')
    .eq('project_id', id)
    .order('opportunity_score', { ascending: false, nullsFirst: false });

  if (keywordsError) throw new Error(`Failed to get keywords: ${keywordsError.message}`);

  return { ...project, keywords: keywords || [] };
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.from('ds_projects').delete().eq('id', id);

  if (error) throw new Error(`Failed to delete project: ${error.message}`);
}

/**
 * Add keywords to a project
 */
export async function addKeywords(
  projectId: string,
  keywords: Array<{
    keyword: string;
    source: KeywordSource;
    variant_count?: number;
  }>
): Promise<Keyword[]> {
  const supabase = createServerClient();

  const rows = keywords.map(k => ({
    project_id: projectId,
    keyword: k.keyword,
    source: k.source,
    variant_count: k.variant_count || 0,
  }));

  const { data, error } = await supabase
    .from('ds_keywords')
    .upsert(rows, { onConflict: 'project_id,keyword' })
    .select();

  if (error) throw new Error(`Failed to add keywords: ${error.message}`);
  return data || [];
}

/**
 * Update keyword scores
 */
export async function updateKeywordScores(
  keywordId: string,
  scores: {
    opportunity_score?: number;
    yt_avg_views?: number;
    yt_videos_last_12mo?: number;
    yt_median_top3_views?: number;
  }
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('ds_keywords')
    .update(scores)
    .eq('id', keywordId);

  if (error) throw new Error(`Failed to update keyword: ${error.message}`);
}

/**
 * Update keyword volume
 */
export async function updateKeywordVolume(
  keywordId: string,
  volume: number
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('ds_keywords')
    .update({
      volume,
      volume_verified_at: new Date().toISOString(),
    })
    .eq('id', keywordId);

  if (error) throw new Error(`Failed to update keyword volume: ${error.message}`);
}

/**
 * Delete keywords
 */
export async function deleteKeywords(keywordIds: string[]): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('ds_keywords')
    .delete()
    .in('id', keywordIds);

  if (error) throw new Error(`Failed to delete keywords: ${error.message}`);
}

/**
 * Export keywords as CSV
 */
export function exportToCSV(keywords: Keyword[]): string {
  const headers = [
    'keyword',
    'source',
    'variant_count',
    'opportunity_score',
    'volume',
    'avg_views',
    'videos_last_12mo',
    'median_top3_views',
    'created_at',
  ];

  const rows = keywords.map(k => [
    `"${k.keyword.replace(/"/g, '""')}"`,
    k.source,
    k.variant_count,
    k.opportunity_score ?? '',
    k.volume ?? '',
    k.yt_avg_views ?? '',
    k.yt_videos_last_12mo ?? '',
    k.yt_median_top3_views ?? '',
    k.created_at,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
