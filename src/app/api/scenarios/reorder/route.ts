import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, scenarioIds } = body;

    if (!trackId || !Array.isArray(scenarioIds)) {
      return NextResponse.json({
        success: false,
        error: 'trackId and scenarioIds array are required'
      }, { status: 400 });
    }

    console.log(`🔄 Reordering ${scenarioIds.length} scenarios in track ${trackId}`);

    // Update each scenario's display_order
    const updates = scenarioIds.map((scenarioId, index) => ({
      id: scenarioId,
      display_order: index
    }));

    // Update all scenarios in a transaction-like manner
    for (const update of updates) {
      const { error } = await supabase
        .from('scenarios')
        .update({ display_order: update.display_order })
        .eq('id', update.id)
        .eq('track_id', trackId); // Safety check: only update if in correct track

      if (error) {
        console.error(`❌ Error updating scenario ${update.id}:`, error);
        throw error;
      }
    }

    console.log(`✅ Successfully reordered scenarios in track ${trackId}`);

    return NextResponse.json({
      success: true,
      updated: updates.length
    });

  } catch (error) {
    console.error('❌ Error reordering scenarios:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
