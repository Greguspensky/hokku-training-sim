import { NextRequest, NextResponse } from 'next/server';

interface ScenarioTrackAssignment {
  id: string;
  track_id: string;
  scenario_id: string;
  assigned_at: string;
  assigned_by?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('track_id');
  const scenarioId = searchParams.get('scenario_id');

  try {
    if (typeof globalThis === 'undefined') {
      return NextResponse.json({
        success: false,
        error: 'Server environment not available'
      }, { status: 500 });
    }

    if (!globalThis.__scenarioTrackAssignmentsStore) {
      globalThis.__scenarioTrackAssignmentsStore = new Map();
    }

    const store = globalThis.__scenarioTrackAssignmentsStore as Map<string, ScenarioTrackAssignment>;
    const assignments = Array.from(store.values());

    let filteredAssignments = assignments;

    if (trackId) {
      filteredAssignments = assignments.filter(a => a.track_id === trackId);
    } else if (scenarioId) {
      filteredAssignments = assignments.filter(a => a.scenario_id === scenarioId);
    }

    return NextResponse.json({
      success: true,
      data: filteredAssignments
    });

  } catch (error) {
    console.error('Error fetching scenario-track assignments:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch assignments'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { track_id, scenario_id, assigned_by } = body;

    if (!track_id || !scenario_id) {
      return NextResponse.json({
        success: false,
        error: 'track_id and scenario_id are required'
      }, { status: 400 });
    }

    if (typeof globalThis === 'undefined') {
      return NextResponse.json({
        success: false,
        error: 'Server environment not available'
      }, { status: 500 });
    }

    if (!globalThis.__scenarioTrackAssignmentsStore) {
      globalThis.__scenarioTrackAssignmentsStore = new Map();
    }

    const store = globalThis.__scenarioTrackAssignmentsStore as Map<string, ScenarioTrackAssignment>;

    // Check if assignment already exists
    const existingKey = `${track_id}_${scenario_id}`;
    if (store.has(existingKey)) {
      return NextResponse.json({
        success: false,
        error: 'Scenario is already assigned to this track'
      }, { status: 409 });
    }

    const assignment: ScenarioTrackAssignment = {
      id: `assignment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      track_id,
      scenario_id,
      assigned_at: new Date().toISOString(),
      assigned_by
    };

    store.set(existingKey, assignment);

    console.log(`✅ Assigned scenario ${scenario_id} to track ${track_id}`);

    return NextResponse.json({
      success: true,
      data: assignment
    });

  } catch (error) {
    console.error('Error creating scenario-track assignment:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create assignment'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('track_id');
  const scenarioId = searchParams.get('scenario_id');

  if (!trackId || !scenarioId) {
    return NextResponse.json({
      success: false,
      error: 'track_id and scenario_id are required'
    }, { status: 400 });
  }

  try {
    if (typeof globalThis === 'undefined') {
      return NextResponse.json({
        success: false,
        error: 'Server environment not available'
      }, { status: 500 });
    }

    if (!globalThis.__scenarioTrackAssignmentsStore) {
      globalThis.__scenarioTrackAssignmentsStore = new Map();
    }

    const store = globalThis.__scenarioTrackAssignmentsStore as Map<string, ScenarioTrackAssignment>;
    const key = `${trackId}_${scenarioId}`;

    if (!store.has(key)) {
      return NextResponse.json({
        success: false,
        error: 'Assignment not found'
      }, { status: 404 });
    }

    const assignment = store.get(key);
    store.delete(key);

    console.log(`✅ Removed scenario ${scenarioId} from track ${trackId}`);

    return NextResponse.json({
      success: true,
      data: assignment
    });

  } catch (error) {
    console.error('Error removing scenario-track assignment:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to remove assignment'
    }, { status: 500 });
  }
}