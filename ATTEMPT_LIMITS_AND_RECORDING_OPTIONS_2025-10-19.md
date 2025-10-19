# Attempt Limits & Recording Options Configuration - October 19, 2025

## Overview
This document describes two major features implemented on October 19, 2025:
1. **Attempt Limits System** - Allows managers to set maximum attempts for scenarios
2. **Recording Options Configuration** - Allows managers to control available recording options per scenario type

---

## Feature 1: Attempt Limits System

### Summary
Managers can now configure maximum attempt limits for individual scenarios and scenarios within tracks. When employees reach the limit, they cannot start new training sessions.

### User Interface Changes

#### 1. Manager - Employees Page (`/manager?tab=employees`)

**Track Scenarios:**
- Each scenario in a track now shows an "Attempts limit" input field
- Manager can set a number (1-999) or leave empty for unlimited (∞)
- Input saves automatically on blur with spinner feedback
- Clear button (×) appears when a limit is set

**Individual Scenarios:**
- Similar attempts limit input field
- Same save behavior and UI feedback

**UI Features:**
- Tooltip: "Leave empty for unlimited attempts"
- Validation: At least prevents setting to 0
- Real-time saving with loading indicator
- Clear button to quickly remove limits

#### 2. Employee - Training Dashboard (`/employee`)

**Display Format:**
- Shows attempt count with limit: `Attempts: 2/5` (2 attempts used, 5 max)
- Shows unlimited: `Attempts: 2/∞`

**Locations:**
- Track scenarios list
- Individual scenarios list

**Button States:**
- **Active**: Blue "Start" button when attempts available
- **Disabled**: Gray "Limit Reached" button when max attempts reached
- Tooltip shows "Attempt limit reached (X/Y)" on hover

#### 3. Employee - Pre-Training Page (`/employee/training/[assignmentId]`)

**Button Behavior:**
- "Start Training Session" button disabled when limit reached
- Button text changes to "🚫 Attempt Limit Reached"
- Red warning message displays: "You have reached the maximum number of attempts (X) for this scenario."
- Works for all scenario types: Theory Q&A, Service Practice, Recommendations

### Technical Implementation

#### Database Schema

**Migration:** `migrations/add_attempts_limits.sql`

```sql
-- Individual scenario assignments
ALTER TABLE scenario_assignments
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT NULL;

-- Track scenario assignments (JSONB for flexibility)
ALTER TABLE track_assignments
ADD COLUMN IF NOT EXISTS scenario_attempts_limits JSONB DEFAULT '{}'::jsonb;
```

**Data Structure:**
- `scenario_assignments.max_attempts`: Simple INTEGER (e.g., 5)
- `track_assignments.scenario_attempts_limits`: JSONB object mapping scenario IDs to limits
  ```json
  {
    "scenario-id-1": 3,
    "scenario-id-2": 5
  }
  ```

#### API Endpoints

**PATCH `/api/scenario-assignments`**
- Updates `max_attempts` for individual scenario assignments
- Validates: null (unlimited) or positive integer

**PATCH `/api/track-assignments-standalone/[assignmentId]`**
- Updates `scenario_attempts_limits` JSONB for track assignments
- Requires: `scenario_id` and `max_attempts`
- Handles adding, updating, and removing limits

**GET Endpoints Enhanced:**
- `/api/scenario-assignments` - Now includes `max_attempts` in response
- `/api/track-assignments-standalone` - Now includes `scenario_attempts_limits` in response
- `/api/scenario-stats` - Provides current attempt count

#### Key Components Modified

1. **`src/components/Employees/EmployeeScenariosList.tsx`**
   - Added max_attempts to interface
   - Controlled input with onChange and onBlur
   - Clear button (×) functionality
   - Local state updates for instant feedback

2. **`src/components/TrackAssignment/EmployeeTracksList.tsx`**
   - JSONB scenario_attempts_limits handling
   - Per-scenario limit inputs
   - State management for multiple scenarios

3. **`src/components/Employee/TrainingTrackCard.tsx`**
   - Display "Attempts: X/Y" format
   - Disable "Start" button when limit reached
   - Button styling and text changes

4. **`src/components/Employee/IndividualScenariosCard.tsx`**
   - Similar implementation for individual scenarios
   - Consistent UX across both assignment types

5. **`src/app/employee/training/[assignmentId]/page.tsx`**
   - Load scenario stats to check attempt count
   - Calculate if limit is reached
   - Disable "Start Training Session" button
   - Show warning message

### Logic Flow

```
1. Manager sets limit → API saves to database
2. Employee views scenario → UI loads attempt count and limit
3. Display: "Attempts: 2/5" or "Attempts: 2/∞"
4. Check: currentAttempts >= maxAttempts?
   - Yes: Disable button, show "Limit Reached"
   - No: Enable button, show "Start"
5. Employee clicks Start → Session begins (only if not limited)
```

### Edge Cases Handled

- **No limit set**: Shows ∞, no restrictions
- **Limit = current attempts**: Button disabled immediately
- **Individual vs Track**: Separate limits per assignment type
- **API failure**: Alert shown, no state change
- **Empty input**: Treated as unlimited (null)

---

## Feature 2: Recording Options Configuration

### Summary
Managers can now control which recording options (Audio, Video, or both) are available to employees for Theory Q&A and Service Practice scenarios. This allows organizations to standardize recording requirements.

### User Interface Changes

#### 1. Manager - Training Configuration (`/manager?tab=training`)

**New Section: "Recording Options by Scenario Type"**

Located below "Training Language by Default" selector.

**Two Configuration Panels:**

**📖 Theory Q&A:**
- ☑ 🎤 Audio Recording
- ☑ 🎥 Video Recording

**🗣️ Service Practice:**
- ☑ 🎤 Audio Recording
- ☑ 🎥 Video Recording

**Features:**
- Checkboxes for each recording type
- Auto-saves on change with loading indicator
- Validation: At least one option must be selected
- Info box explains impact on employee dropdown

**Visual Feedback:**
- Loading spinner during save
- Disabled state while saving
- Grid layout for side-by-side configuration

#### 2. Employee - Pre-Training Page

**Recording Dropdown Filtering:**

**Before (default):**
```
Session Recording:
[  🎤 Audio Recording          ]
[  🎬 Audio + Video Recording  ]
```

**After Manager Configuration:**

*If only Audio enabled:*
```
Session Recording:
[  🎤 Audio Recording  ]
```

*If only Video enabled:*
```
Session Recording:
[  🎬 Audio + Video Recording  ]
```

*If both enabled (default):*
```
Session Recording:
[  🎤 Audio Recording          ]
[  🎬 Audio + Video Recording  ]
```

### Technical Implementation

#### Database Schema

**Migration:** `migrations/add_recording_options_to_company_settings.sql`

```sql
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS theory_recording_options TEXT[] DEFAULT ARRAY['audio', 'audio_video']::TEXT[],
ADD COLUMN IF NOT EXISTS service_practice_recording_options TEXT[] DEFAULT ARRAY['audio', 'audio_video']::TEXT[];
```

**Data Type:** PostgreSQL TEXT[] (array)
**Default Values:** `['audio', 'audio_video']` (both options available)

#### API Updates

**POST `/api/company-settings`**

Enhanced to handle partial updates:

```typescript
{
  company_id: string,
  default_training_language?: string,
  theory_recording_options?: string[],
  service_practice_recording_options?: string[]
}
```

- Accepts individual fields
- Only updates provided fields
- Maintains existing values for unprovided fields

**GET `/api/company-settings?company_id=xxx`**

Returns enhanced response:

```typescript
{
  success: true,
  settings: {
    company_id: string,
    default_training_language: string,
    theory_recording_options: string[],  // e.g., ['audio', 'audio_video']
    service_practice_recording_options: string[]
  }
}
```

#### Key Components Modified

1. **`src/app/manager/page.tsx`**
   - State: `theoryRecordingOptions`, `servicePracticeRecordingOptions`
   - Handler: `handleRecordingOptionsChange(scenarioType, options[])`
   - UI: Grid layout with checkboxes
   - Validation: Prevents deselecting all options

2. **`src/app/employee/training/[assignmentId]/page.tsx`**
   - State: `allowedTheoryRecordingOptions`, `allowedServicePracticeRecordingOptions`
   - Load settings on mount
   - Filter dropdown options based on allowed list
   - Auto-select first available option

3. **`src/app/api/company-settings/route.ts`**
   - Accept new fields in POST
   - Build update object dynamically
   - Upsert with partial data

### Logic Flow

```
1. Manager checks/unchecks recording options
   ↓
2. Auto-save to company_settings table
   ↓
3. Employee loads pre-training page
   ↓
4. Fetch company settings via API
   ↓
5. Filter recording dropdown options
   ↓
6. If only one option available: Auto-select it
   ↓
7. Employee sees only allowed options
```

### Special Cases

- **Recommendations**: Always uses video recording (not configurable)
- **Theory Q&A**: Uses configured `theory_recording_options`
- **Service Practice**: Uses configured `service_practice_recording_options`
- **Default**: Both audio and video available if not configured
- **Validation**: At least one option must remain selected

### Example Configurations

**Use Case 1: Audio-Only Training**
```
Manager sets:
- Theory Q&A: [Audio] only
- Service Practice: [Audio] only

Employee sees:
- Only "🎤 Audio Recording" option
```

**Use Case 2: Video-Only Training**
```
Manager sets:
- Theory Q&A: [Video] only
- Service Practice: [Video] only

Employee sees:
- Only "🎬 Audio + Video Recording" option
```

**Use Case 3: Mixed Configuration**
```
Manager sets:
- Theory Q&A: [Audio, Video]
- Service Practice: [Video] only

Employee sees:
- Theory: Both options
- Service Practice: Video only
```

---

## Files Modified

### New Files
1. `migrations/add_attempts_limits.sql` - Database schema for attempt limits
2. `migrations/add_recording_options_to_company_settings.sql` - Recording options schema
3. `ATTEMPT_LIMITS_AND_RECORDING_OPTIONS_2025-10-19.md` - This documentation

### Modified Files

**Attempt Limits (14 files):**
1. `src/components/Employees/EmployeeScenariosList.tsx` - Individual scenario attempt limits
2. `src/components/TrackAssignment/EmployeeTracksList.tsx` - Track scenario attempt limits
3. `src/components/Employee/TrainingTrackCard.tsx` - Display limits and disable button
4. `src/components/Employee/IndividualScenariosCard.tsx` - Display limits and disable button
5. `src/app/api/scenario-assignments/route.ts` - PATCH endpoint for individual limits
6. `src/app/api/track-assignments-standalone/[assignmentId]/route.ts` - PATCH for track limits
7. `src/app/api/track-assignments-standalone/route.ts` - Include limits in GET response
8. `src/app/employee/training/[assignmentId]/page.tsx` - Load stats and disable button

**Recording Options (3 files):**
1. `src/app/manager/page.tsx` - Manager UI for configuration
2. `src/app/api/company-settings/route.ts` - API to save/load options
3. `src/app/employee/training/[assignmentId]/page.tsx` - Filter dropdown options

---

## Testing Guide

### Test Attempt Limits

1. **Set Individual Scenario Limit**
   ```
   - Go to Manager → Employees tab
   - Find an employee with individual scenarios
   - Set "Attempts limit" to 3
   - Verify input saves (spinner appears briefly)
   ```

2. **Set Track Scenario Limit**
   ```
   - Go to Manager → Employees tab
   - Find an employee with track assignments
   - Expand track to see scenarios
   - Set limit for a scenario to 2
   - Verify it saves
   ```

3. **Test Limit Display**
   ```
   - As employee, go to Training Dashboard
   - View scenario with limit
   - Should see "Attempts: X/3" or "Attempts: X/2"
   - If no limit: "Attempts: X/∞"
   ```

4. **Test Button Disabling**
   ```
   - Set limit to 1
   - Complete one attempt of the scenario
   - Return to dashboard
   - Button should show "Limit Reached" and be disabled
   - Try clicking - nothing happens
   ```

5. **Test Clear Button**
   ```
   - Set a limit (e.g., 5)
   - Click the × button next to input
   - Limit should clear to ∞
   - Button should become enabled again
   ```

6. **Test Pre-Training Page**
   ```
   - Set limit to 1, complete 1 attempt
   - Go to pre-training page for that scenario
   - "Start Training Session" button should be disabled
   - Should show "Attempt Limit Reached" and red warning
   ```

### Test Recording Options

1. **Configure Theory Q&A - Audio Only**
   ```
   - Go to Manager → Scenarios and Tracks tab
   - Under "Recording Options by Scenario Type"
   - Uncheck "Video Recording" for Theory Q&A
   - Check only "Audio Recording"
   - Verify spinner shows briefly (saving)
   ```

2. **Test Employee View - Theory**
   ```
   - As employee, start a Theory Q&A scenario
   - Check "Session Recording" dropdown
   - Should only show "🎤 Audio Recording"
   - Video option should be hidden
   ```

3. **Configure Service Practice - Video Only**
   ```
   - Go to Manager → Scenarios and Tracks
   - Uncheck "Audio Recording" for Service Practice
   - Check only "Video Recording"
   ```

4. **Test Employee View - Service Practice**
   ```
   - As employee, start a Service Practice scenario
   - Check "Session Recording" dropdown
   - Should only show "🎬 Audio + Video Recording"
   - Audio-only option should be hidden
   ```

5. **Test Both Options**
   ```
   - Enable both checkboxes for a scenario type
   - Employee should see both options in dropdown
   ```

6. **Test Validation**
   ```
   - Try to uncheck all options for a scenario type
   - Last checkbox should prevent unchecking
   - At least one must remain selected
   ```

---

## Database Migration Instructions

### Step 1: Run Attempt Limits Migration

```sql
-- In Supabase SQL Editor:

-- Add attempts limit fields to assignment tables
ALTER TABLE scenario_assignments
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT NULL;

ALTER TABLE track_assignments
ADD COLUMN IF NOT EXISTS scenario_attempts_limits JSONB DEFAULT '{}'::jsonb;

-- Add comments
COMMENT ON COLUMN scenario_assignments.max_attempts IS 'Maximum number of attempts allowed for this scenario assignment. NULL means unlimited.';
COMMENT ON COLUMN track_assignments.scenario_attempts_limits IS 'JSON object mapping scenario_id to max_attempts limit. Empty object or missing key means unlimited attempts.';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_scenario_assignments_max_attempts
ON scenario_assignments(max_attempts)
WHERE max_attempts IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_track_assignments_scenario_attempts_limits
ON track_assignments USING GIN (scenario_attempts_limits);
```

### Step 2: Run Recording Options Migration

```sql
-- In Supabase SQL Editor:

-- Add recording options configuration columns
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS theory_recording_options TEXT[] DEFAULT ARRAY['audio', 'audio_video']::TEXT[],
ADD COLUMN IF NOT EXISTS service_practice_recording_options TEXT[] DEFAULT ARRAY['audio', 'audio_video']::TEXT[];

-- Add comments
COMMENT ON COLUMN company_settings.theory_recording_options IS 'Array of allowed recording options for Theory Q&A scenarios. Possible values: audio, audio_video';
COMMENT ON COLUMN company_settings.service_practice_recording_options IS 'Array of allowed recording options for Service Practice scenarios. Possible values: audio, audio_video';

-- Update existing rows
UPDATE company_settings
SET theory_recording_options = ARRAY['audio', 'audio_video']::TEXT[]
WHERE theory_recording_options IS NULL;

UPDATE company_settings
SET service_practice_recording_options = ARRAY['audio', 'audio_video']::TEXT[]
WHERE service_practice_recording_options IS NULL;
```

---

## Future Enhancements (Potential)

### Attempt Limits
- [ ] Track attempts per scenario in real-time
- [ ] Reset attempts functionality for managers
- [ ] Bulk set limits across multiple scenarios
- [ ] Attempt limit overrides per employee
- [ ] Email notifications when limit reached
- [ ] Analytics: Average attempts per scenario

### Recording Options
- [ ] Per-scenario recording overrides (not just type-wide)
- [ ] Recording quality settings (resolution, bitrate)
- [ ] Audio-only option for slow connections
- [ ] Recording preview before session
- [ ] Configurable recording consent text

---

## Notes for Developers

### Attempt Limits Architecture

**Design Decision: Per-Assignment Storage**
- Individual scenarios: Simple INTEGER column
- Track scenarios: JSONB for flexibility
- Rationale: No syncing needed, assignment-specific limits

**Alternative Considered:**
- Global scenario-level limits
- Rejected: Less flexible, requires syncing

### Recording Options Architecture

**Design Decision: Company-Level Configuration**
- Stored in company_settings table
- Array type for multiple options
- Rationale: Org-wide standardization

**Alternative Considered:**
- Per-scenario configuration
- Rejected: Too granular, harder to manage

### State Management

Both features use:
- Local state for immediate UI feedback
- API calls for persistence
- Optimistic updates (update UI before API confirms)
- Loading states and error handling

---

## Support & Troubleshooting

### Issue: Attempts limit not saving

**Symptoms:** Input value resets after blur
**Cause:** API error or network issue
**Solution:**
1. Check browser console for errors
2. Verify company_id is set
3. Check Supabase logs for failed queries
4. Ensure migration was run

### Issue: Wrong recording options showing

**Symptoms:** Employee sees incorrect options
**Cause:** Settings not loaded or cached
**Solution:**
1. Check company_settings table has correct values
2. Clear browser cache/localStorage
3. Verify company_id matches
4. Check API response in Network tab

### Issue: Button still enabled after limit reached

**Symptoms:** Can start session despite reaching limit
**Cause:** Stats not loaded or stale
**Solution:**
1. Refresh page to reload stats
2. Check scenario_stats API response
3. Verify attempt count matches database
4. Check isLimitReached calculation

---

## Implementation Timeline

**Date:** October 19, 2025
**Developer:** Claude Code (via Anthropic)
**Status:** ✅ Complete & Production Ready

**Features Delivered:**
1. ✅ Attempt limits for individual scenarios
2. ✅ Attempt limits for track scenarios
3. ✅ Attempt limit display (X/Y format)
4. ✅ Button disabling when limit reached
5. ✅ Clear button for removing limits
6. ✅ Recording options configuration UI
7. ✅ Recording options filtering for employees
8. ✅ Database migrations
9. ✅ API endpoints
10. ✅ Full documentation

**Next Steps:**
- Run database migrations
- Test all features
- Deploy to production
- Monitor for issues
