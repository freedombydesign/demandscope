import { NextRequest, NextResponse } from 'next/server';
import { createProject, getProjects, deleteProject, renameProject, addKeywords, exportToCSV, getProject } from '@/lib/projects';
import type { Mode, Geo, KeywordSource } from '@/types';

// GET /api/projects - List all projects
// GET /api/projects?id=xxx - Get single project with keywords
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (id) {
      const project = await getProject(id);
      return NextResponse.json(project);
    }

    const projects = await getProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create project or add keywords
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { name, mode, geo } = body as {
        action: 'create';
        name: string;
        mode: Mode;
        geo: Geo;
      };

      if (!name || !mode || !geo) {
        return NextResponse.json(
          { error: 'Name, mode, and geo are required' },
          { status: 400 }
        );
      }

      const project = await createProject(name, mode, geo);
      return NextResponse.json(project);
    }

    if (action === 'add-keywords') {
      const { projectId, keywords } = body as {
        action: 'add-keywords';
        projectId: string;
        keywords: Array<{
          keyword: string;
          source: KeywordSource;
          variant_count?: number;
        }>;
      };

      if (!projectId || !keywords || !Array.isArray(keywords)) {
        return NextResponse.json(
          { error: 'ProjectId and keywords array are required' },
          { status: 400 }
        );
      }

      const added = await addKeywords(projectId, keywords);
      return NextResponse.json({ added: added.length, keywords: added });
    }

    if (action === 'rename') {
      const { projectId, name } = body as { action: 'rename'; projectId: string; name: string };

      if (!projectId || !name) {
        return NextResponse.json(
          { error: 'ProjectId and name are required' },
          { status: 400 }
        );
      }

      const project = await renameProject(projectId, name);
      return NextResponse.json(project);
    }

    if (action === 'export') {
      const { projectId } = body as { action: 'export'; projectId: string };

      if (!projectId) {
        return NextResponse.json(
          { error: 'ProjectId is required' },
          { status: 400 }
        );
      }

      const project = await getProject(projectId);
      const csv = exportToCSV(project.keywords);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_')}_keywords.csv"`,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Project action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    await deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete project' },
      { status: 500 }
    );
  }
}
