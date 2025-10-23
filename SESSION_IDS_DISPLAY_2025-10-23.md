# Session IDs Display Enhancement - 2025-10-23

## Overview
Added ElevenLabs conversation ID and Supabase video ID display to all session feed views and session detail pages for better tracking and debugging capabilities.

## Date
October 23, 2025

## Status
✅ **COMPLETE** - All changes implemented and tested

---

## Problem Statement

Managers and developers needed quick access to:
1. **ElevenLabs Conversation ID** - For debugging AI conversations and retrieving audio recordings
2. **Supabase Video ID** - For identifying video files in storage and troubleshooting uploads

Previously, these IDs were only available in the database or through console logs, making it difficult to:
- Debug session issues
- Locate specific recordings in Supabase storage
- Verify ElevenLabs API integrations
- Track down problematic sessions

---

## Solution

Added conditional display of both IDs in three key locations:

### 1. Manager Dashboard - Progress Tab Feed
**Component**: `src/components/Manager/SessionFeed.tsx`

Shows all company training sessions with employee information. Added IDs to each session card for quick reference.

### 2. Individual Session Details Page
**Component**: `src/app/employee/sessions/[sessionId]/page.tsx`

Detailed session view accessible by both employees and managers. Added IDs to the Session Details section.

### 3. Employee Training History (Manager View)
**Component**: `src/components/Employee/SessionCard.tsx`

Used in Manager's Progress tab when viewing individual employee training history. Shows IDs for each completed session.

---

## Implementation Details

### Display Format

All three locations use consistent formatting:

```
Attempt ID: <session-uuid>
Scenario ID: <scenario-uuid>
ElevenLabs Conv ID: conv_5101k88qq3gqexwbbtdg5a6k5mft
Video ID: c9c9a2d5-44ef-4cf8-a5b2-8328855e0069-video-1761229776813.mp4
```

### Styling
- **Font**: Monospace (font-mono)
- **Size**: Extra small (text-xs)
- **Color**: Gray (text-gray-400)
- **Spacing**: Small vertical gaps (space-y-0.5)
- **Container**: Inline with existing ID display

### Conditional Display Logic

Both IDs only display when present in the session data:

```typescript
{session.elevenlabs_conversation_id && (
  <div>ElevenLabs Conv ID: {session.elevenlabs_conversation_id}</div>
)}
{session.video_recording_url && (
  <div>Video ID: {session.video_recording_url.split('/').pop()}</div>
)}
```

### Video ID Extraction

The video ID is extracted from the full Supabase storage URL:

```typescript
session.video_recording_url.split('/').pop()
```

**Example**:
- Full URL: `https://tscjbpdorbxmbxcqyiri.supabase.co/storage/v1/object/public/training-recordings/c9c9a2d5-44ef-4cf8-a5b2-8328855e0069-video-1761229776813.mp4`
- Extracted ID: `c9c9a2d5-44ef-4cf8-a5b2-8328855e0069-video-1761229776813.mp4`

---

## Files Modified

### 1. SessionFeed.tsx
**Path**: `/src/components/Manager/SessionFeed.tsx`

**Lines Modified**: 165-176

**Before**:
```tsx
<div className="text-xs text-gray-400 font-mono mt-1 space-y-0.5">
  <div>Attempt ID: {session.id}</div>
  {session.scenario_id && (
    <div>Scenario ID: {session.scenario_id}</div>
  )}
</div>
```

**After**:
```tsx
<div className="text-xs text-gray-400 font-mono mt-1 space-y-0.5">
  <div>Attempt ID: {session.id}</div>
  {session.scenario_id && (
    <div>Scenario ID: {session.scenario_id}</div>
  )}
  {session.elevenlabs_conversation_id && (
    <div>ElevenLabs Conv ID: {session.elevenlabs_conversation_id}</div>
  )}
  {session.video_recording_url && (
    <div>Video ID: {session.video_recording_url.split('/').pop()}</div>
  )}
</div>
```

---

### 2. Session Details Page
**Path**: `/src/app/employee/sessions/[sessionId]/page.tsx`

**Lines Modified**: 407-432

**Before**:
```tsx
<div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
    <div>
      <span className="font-medium text-gray-700">Session ID:</span>
      <div className="mt-1 font-mono text-gray-600 break-all">{session.id}</div>
    </div>
    {session.scenario_id && (
      <div>
        <span className="font-medium text-gray-700">Attempt ID:</span>
        <div className="mt-1 font-mono text-gray-600 break-all">{session.scenario_id}</div>
      </div>
    )}
  </div>
</div>
```

**After**:
```tsx
<div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
    <div>
      <span className="font-medium text-gray-700">Session ID:</span>
      <div className="mt-1 font-mono text-gray-600 break-all">{session.id}</div>
    </div>
    {session.scenario_id && (
      <div>
        <span className="font-medium text-gray-700">Attempt ID:</span>
        <div className="mt-1 font-mono text-gray-600 break-all">{session.scenario_id}</div>
      </div>
    )}
    {session.elevenlabs_conversation_id && (
      <div>
        <span className="font-medium text-gray-700">ElevenLabs Conv ID:</span>
        <div className="mt-1 font-mono text-gray-600 break-all">{session.elevenlabs_conversation_id}</div>
      </div>
    )}
    {session.video_recording_url && (
      <div>
        <span className="font-medium text-gray-700">Video ID:</span>
        <div className="mt-1 font-mono text-gray-600 break-all">{session.video_recording_url.split('/').pop()}</div>
      </div>
    )}
  </div>
</div>
```

---

### 3. SessionCard.tsx
**Path**: `/src/components/Employee/SessionCard.tsx`

**Lines Modified**: 66-77

**Before**:
```tsx
<div className="text-xs text-gray-400 font-mono mt-1 space-y-0.5">
  <div>Attempt ID: {session.id}</div>
  {session.scenario_id && (
    <div>Scenario ID: {session.scenario_id}</div>
  )}
</div>
```

**After**:
```tsx
<div className="text-xs text-gray-400 font-mono mt-1 space-y-0.5">
  <div>Attempt ID: {session.id}</div>
  {session.scenario_id && (
    <div>Scenario ID: {session.scenario_id}</div>
  )}
  {session.elevenlabs_conversation_id && (
    <div>ElevenLabs Conv ID: {session.elevenlabs_conversation_id}</div>
  )}
  {session.video_recording_url && (
    <div>Video ID: {session.video_recording_url.split('/').pop()}</div>
  )}
</div>
```

---

## Database Schema Reference

These fields come from the `training_sessions` table:

```sql
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY,
  scenario_id UUID,
  elevenlabs_conversation_id TEXT,
  video_recording_url TEXT,
  audio_recording_url TEXT,
  -- ... other fields
);
```

### Field Details

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `id` | UUID | Session/Attempt ID | `0312604f-cf78-410c-babe-2d16647d5a8e` |
| `scenario_id` | UUID | Scenario used | `66732f11-5796-4bb2-99e9-04bc62bd2188` |
| `elevenlabs_conversation_id` | TEXT | ElevenLabs API conversation ID | `conv_5101k88qq3gqexwbbtdg5a6k5mft` |
| `video_recording_url` | TEXT | Full Supabase storage URL | `https://.../c9c9a2d5-...mp4` |

---

## Use Cases

### 1. Debugging ElevenLabs Conversations
**Problem**: Manager reports AI not responding correctly
**Solution**:
1. Navigate to Progress tab → Find session
2. Copy ElevenLabs Conv ID
3. Use ID with ElevenLabs API to retrieve full conversation logs
4. Analyze AI behavior and system prompts

### 2. Locating Video Files
**Problem**: Video playback fails or upload issue reported
**Solution**:
1. Open session details page
2. Copy Video ID
3. Search Supabase Storage for exact filename
4. Check file size, upload timestamp, permissions

### 3. Support Ticket Resolution
**Problem**: Employee reports session issue, no details provided
**Solution**:
1. Search manager feed for employee name + date
2. Copy all IDs (Session, Scenario, Conv ID, Video ID)
3. Provide to technical team for investigation
4. IDs allow pinpoint debugging without guessing

### 4. API Integration Testing
**Problem**: Testing ElevenLabs audio retrieval
**Solution**:
1. Complete test session
2. Note Conv ID from session details
3. Test `/api/elevenlabs-conversation-audio` endpoint
4. Verify audio URL generation works correctly

---

## Where IDs Are Displayed

### Manager Dashboard - Progress Tab
**URL**: `http://localhost:3000/manager?tab=training`
**View**: Progress tab → Session feed
**Shows**: All company sessions with employee names
**Access**: Manager only

**Display Location**:
```
[Employee Name] completed a [Training Mode]
[Scenario Name]
[Date] at [Time]

Attempt ID: ...
Scenario ID: ...
ElevenLabs Conv ID: ...  ← NEW
Video ID: ...            ← NEW
```

---

### Manager Progress Tab - Employee View
**URL**: `http://localhost:3000/manager?tab=training` (click employee → Training History)
**View**: Individual employee's training history
**Shows**: All sessions for specific employee
**Access**: Manager only

**Display Location**: Same format as above, filtered to one employee

---

### Session Details Page
**URL**: `http://localhost:3000/employee/sessions/[sessionId]`
**View**: Full session transcript and recordings
**Shows**: Complete session information
**Access**: Employee (own sessions) + Manager (company sessions)

**Display Location**:
```
Session Details
┌─────────────────────────────────────┐
│ Session ID: ...                     │
│ Attempt ID: ...                     │
│ ElevenLabs Conv ID: ...  ← NEW     │
│ Video ID: ...            ← NEW     │
└─────────────────────────────────────┘
```

---

## Technical Considerations

### Performance
- **No Additional API Calls**: IDs pulled from existing session data
- **Minimal Render Impact**: Only displays when IDs exist
- **Efficient String Operation**: `.split('/').pop()` is O(n) but on short strings

### Responsive Design
- Grid layout adjusts from 1 column (mobile) to 2 columns (desktop)
- IDs wrap with `break-all` to prevent overflow
- Monospace font ensures alignment

### Accessibility
- IDs are selectable text for easy copying
- Clear labels distinguish ID types
- Consistent positioning across views

### Security
- IDs are UUIDs/hashes - no sensitive data exposure
- Display controlled by existing auth/RLS policies
- No new security surface added

---

## Testing Performed

### Manual Testing
✅ Manager Progress tab feed displays IDs correctly
✅ Employee training history shows IDs in manager view
✅ Session details page displays IDs in grid layout
✅ IDs only appear when data exists (conditional rendering)
✅ Video filename correctly extracted from URL
✅ Responsive layout works on desktop and mobile
✅ Copy-paste functionality works for all IDs
✅ No TypeScript errors
✅ Next.js compilation successful

### Browser Testing
✅ Chrome - All displays working
✅ Layout responsive at various widths
✅ Monospace font renders correctly

---

## Future Enhancements (Optional)

### 1. Copy Button
Add click-to-copy functionality:
```tsx
<button onClick={() => navigator.clipboard.writeText(session.elevenlabs_conversation_id)}>
  📋 Copy Conv ID
</button>
```

### 2. Direct Links
Link to Supabase Storage or ElevenLabs dashboard:
```tsx
<a href={`https://elevenlabs.io/conversations/${session.elevenlabs_conversation_id}`}>
  View in ElevenLabs →
</a>
```

### 3. ID Tooltips
Add hover tooltips with full URLs:
```tsx
<span title={session.video_recording_url}>
  Video ID: {session.video_recording_url.split('/').pop()}
</span>
```

### 4. Admin-Only Display
Hide IDs from employees, show only to managers:
```tsx
{userRole === 'manager' && session.elevenlabs_conversation_id && (
  <div>ElevenLabs Conv ID: {session.elevenlabs_conversation_id}</div>
)}
```

---

## Related Documentation

- **DATABASE_REFERENCE.md** - Full `training_sessions` table schema
- **API_REFERENCE.md** - ElevenLabs conversation endpoints
- **VIDEO_RECORDING_SYSTEM_DOCUMENTATION.md** - Video upload flow
- **VIDEO_UPLOAD_FIX_2025-10-15.md** - Video file naming conventions

---

## Rollback Instructions

If these changes need to be reverted:

1. **SessionFeed.tsx** - Remove lines 170-175
2. **page.tsx (sessions/[sessionId])** - Remove lines 419-430
3. **SessionCard.tsx** - Remove lines 71-76

Or revert to commit before this change:
```bash
git log --oneline | grep "Add session IDs display"
git revert <commit-hash>
```

---

## Maintenance Notes

### When Adding New Session Sources
If new components display training sessions, ensure they also show these IDs:
1. Add conditional rendering for `elevenlabs_conversation_id`
2. Add conditional rendering for `video_recording_url` with `.split('/').pop()`
3. Use consistent styling (monospace, gray, small)
4. Update this documentation

### Database Field Changes
If field names change in `training_sessions` table:
1. Update all three components
2. Update TypeScript interfaces in `src/lib/training-sessions.ts`
3. Test all three display locations
4. Update this documentation

---

## Summary

This enhancement improves the debugging and support experience by surfacing key technical IDs in the UI. Managers and developers can now quickly:

✅ Identify ElevenLabs conversations for audio/transcript debugging
✅ Locate video files in Supabase Storage
✅ Provide precise technical details for support tickets
✅ Verify API integrations during testing

All changes maintain existing functionality while adding valuable technical visibility.

---

**Author**: Claude Code
**Date**: October 23, 2025
**Status**: Production Ready ✅
