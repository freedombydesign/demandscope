import { NextRequest, NextResponse } from 'next/server';
import { deleteKeywords } from '@/lib/projects';

// DELETE /api/keywords - Delete keywords by IDs
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Keyword IDs array is required' },
        { status: 400 }
      );
    }

    await deleteKeywords(ids);
    return NextResponse.json({ deleted: ids.length });
  } catch (error) {
    console.error('Delete keywords error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete keywords' },
      { status: 500 }
    );
  }
}
