# Scenario Ordering Fix - 2026-02-04

## Problem
Scenarios were displaying in different orders across different views in the application, despite having a drag-and-drop reordering feature in the manager interface. The employee dashboard and training pages were not respecting the custom order set by managers.

## Root Cause
Multiple API endpoints and services were sorting scenarios by `created_at` instead of `display_order`, causing inconsistent ordering across the application.

## Solution
Fixed all scenario queries to use `display_order` field with ascending sort order.

## Files Modified

### 1. `/src/app/api/tracks/track-assignments-standalone/route.ts` (Line 133)
**Before:**
```typescript
.order('created_at', { ascending: true })
```

**After:**
```typescript
.order('display_order', { ascending: true })
```

**Context:** Employee dashboard API endpoint that loads track assignments with scenarios.

### 2. `/src/app/api/tracks/track-assignments-standalone/[assignmentId]/route.ts` (Line 181)
**Before:**
```typescript
.order('created_at')
```

**After:**
```typescript
.order('display_order', { ascending: true })
```

**Context:** Training page API endpoint that loads a specific assignment with scenarios.

### 3. `/src/lib/scenarios.ts` (Line 312)
**Before:**
```typescript
.order('created_at', { ascending: false })
```

**After:**
```typescript
.order('display_order', { ascending: true })
```

**Context:** `getScenariosByTrack()` service method used by the TrainingTrackCard component.

## Database Schema
The `display_order` column was added to the scenarios table via migration:

```sql
ALTER TABLE scenarios
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Initialize display_order based on creation order
UPDATE scenarios
SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY track_id ORDER BY created_at) - 1 as row_num
  FROM scenarios
) AS subquery
WHERE scenarios.id = subquery.id;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_scenarios_track_order ON scenarios(track_id, display_order);
```

## Related Components

### Manager Interface (Drag-and-Drop)
- **File:** `/src/app/manager/page.tsx`
- **Library:** `@dnd-kit/core` and `@dnd-kit/sortable`
- **Features:**
  - Hamburger icon (☰) for dragging scenarios
  - Only enabled when viewing specific track (not "All")
  - Instant UI feedback before API call
  - Updates `display_order` via `/api/scenarios/reorder` endpoint

### Employee Dashboard
- **File:** `/src/app/employee/page.tsx`
- **Component:** `TrainingTrackCard.tsx`
- **Data Flow:**
  1. Calls `/api/tracks/track-assignments-standalone?employee_id=${employeeTableId}`
  2. Which fetches scenarios ordered by `display_order`
  3. Renders scenarios in correct order

### Training Page
- **File:** `/src/app/employee/training/[assignmentId]/page.tsx`
- **Data Flow:**
  1. Calls `/api/tracks/track-assignments-standalone/[assignmentId]`
  2. Which fetches scenarios ordered by `display_order`
  3. Navigates through scenarios in correct order

## Testing Checklist

### ✅ Manager View
1. Go to `/manager?tab=training`
2. Select a specific track (e.g., "Track2")
3. Drag scenarios using hamburger icon
4. Verify order changes immediately in UI
5. Refresh page - order persists

### ✅ Employee Dashboard
1. Go to `/employee`
2. View assigned track card
3. Verify scenarios appear in same order as manager set
4. Refresh page - order remains consistent

### ✅ Training Page
1. Start training session from employee dashboard
2. Navigate through scenarios
3. Verify scenarios appear in correct order
4. Check that completed scenarios maintain order

## Implementation Notes

### Why Three Fixes Were Needed
The application had three separate code paths for loading scenarios:
1. **Employee dashboard** - Loads all assignments for an employee
2. **Training page** - Loads a specific assignment by ID
3. **Scenario service** - Generic scenario fetching used by components

Each path was independently sorting by `created_at`, causing all three to show different orders than the manager's drag-and-drop view.

### Order Consistency
All queries now use:
```typescript
.order('display_order', { ascending: true })
```

Previously, some used `ascending: false` or omitted the parameter entirely, causing additional inconsistency.

## Related Documentation
- **DRAG_AND_DROP_IMPLEMENTATION.md** - Original drag-and-drop feature implementation
- **DATABASE_REFERENCE.md** - Complete schema including display_order field
- **add-scenario-display-order.sql** - Migration file for display_order column

## Status
✅ **COMPLETE** - All scenario ordering issues resolved (2026-02-04)

---

**Last Updated:** 2026-02-04
**Author:** Claude Code
**Related Issues:** Scenario order inconsistency between manager and employee views
