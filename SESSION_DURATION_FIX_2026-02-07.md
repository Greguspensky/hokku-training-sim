# Session Duration Fix - February 7, 2026

## Problem Description

Training sessions for user `irina@4elem.elem` (and potentially others) showed **0 seconds duration** despite having:
- 25-45 transcript messages
- 3-7 minutes of actual audio recordings
- Valid ElevenLabs conversation IDs

Example issue: Session `7388a49d-3ee8-4700-a44b-b537f915e7aa` showed "7m 0s" after initial estimate fix, but actual audio was only 3 minutes long.

## Root Cause

### Issue 1: Session Start Time Not Captured
**Location**: `src/hooks/useElevenLabsConversation.ts`

The session start timestamp (`sessionStartTimeRef.current`) was only being set when recording started, not when the session actually began. This caused:

```typescript
// In stopSession() - line 850
const startTime = new Date(sessionStartTimeRef.current || Date.now());
```

If `sessionStartTimeRef.current` was unset (null/0), the fallback `Date.now()` was used **at the END** of the session, making both timestamps identical:

```
started_at: "2026-01-19T17:47:02.400Z"
ended_at:   "2026-01-19T17:47:02.400Z"  // SAME!
Result:     0 seconds duration
```

### Issue 2: Rough Duration Estimation
Initial fix used crude estimation:
```
transcriptMessages × 10 seconds = estimated duration
```

This was inaccurate because:
- Doesn't account for pauses, silence, or thinking time
- Assumes uniform message length
- Example: 42 messages × 10s = 420s (7m 0s), but actual was 181s (3m 1s)

## Solution

### Part 1: Code Fix (Prevents Future Issues) ✅

**File**: `src/hooks/useElevenLabsConversation.ts`

#### Change 1: Capture Start Time Immediately (Line ~729)
```typescript
const startSession = useCallback(async () => {
  // ... guard checks ...

  session.setStartingSession(true);

  // CRITICAL: Capture session start time IMMEDIATELY to ensure accurate duration tracking
  sessionStartTimeRef.current = Date.now();
  console.log('⏱️ Session start time captured:', new Date(sessionStartTimeRef.current).toISOString());

  // ... rest of session initialization ...
}, [/* dependencies */]);
```

#### Change 2: Preserve Accurate Start Time in Recording (Line ~574, ~590)
```typescript
const startSessionRecording = useCallback(async () => {
  // ... setup code ...

  setIsRecording(true);
  // Only set start time if not already set (preserve accurate start from startSession)
  if (!sessionStartTimeRef.current) {
    sessionStartTimeRef.current = Date.now();
  }

  // ... rest of recording code ...
}, [/* dependencies */]);
```

#### Change 3: Add Warning for Missing Start Time (Line ~850)
```typescript
const stopSession = useCallback(async () => {
  // ... stop logic ...

  const endTime = new Date();
  const startTime = new Date(sessionStartTimeRef.current || Date.now());

  // Warn if start time wasn't captured (shouldn't happen anymore after fix)
  if (!sessionStartTimeRef.current) {
    console.error('⚠️ WARNING: Session start time was not captured! Using current time as fallback - duration will be incorrect!');
  }

  // ... save session with accurate duration ...
}, [/* dependencies */]);
```

**Result**: All future sessions will have accurate start/end timestamps and durations.

---

### Part 2: Database Repair (Fixes Existing Sessions) ✅

Created diagnostic and repair API endpoints:

#### Endpoint 1: Check Session Durations
**Path**: `/api/debug/check-session-durations`
**Method**: GET
**Query Params**: `email` (optional, defaults to irina@4elem.elem)

**Purpose**: Diagnose sessions with incorrect durations

**Example**:
```bash
curl "http://localhost:3001/api/debug/check-session-durations?email=irina@4elem.elem"
```

**Response**:
```json
{
  "user": { "id": "...", "email": "irina@4elem.elem" },
  "total_sessions": 9,
  "sessions_with_zero_duration": 7,
  "sessions_needing_fix": 3,
  "sessions": [
    {
      "id": "00045c55-cc6d-4e4e-ae2e-dbb71fdc588d",
      "stored_duration_seconds": 0,
      "calculated_duration_seconds": 0,
      "transcript_messages": 25,
      "should_be_fixed": true
    }
    // ... more sessions
  ]
}
```

---

#### Endpoint 2: Fix Session Duration (Accurate)
**Path**: `/api/debug/fix-session-duration-accurate`
**Method**: POST
**Body**: `{ "sessionId": "..." }`

**Purpose**: Fix a single session with **accurate** duration from ElevenLabs API

**Data Source Priority**:
1. ✅ **ElevenLabs `metadata.call_duration_secs`** (most accurate - actual call duration)
2. ElevenLabs transcript timestamps (first message → last message)
3. Audio file size estimation (as last resort)

**Example**:
```bash
curl -X POST http://localhost:3001/api/debug/fix-session-duration-accurate \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "7388a49d-3ee8-4700-a44b-b537f915e7aa"}'
```

**Response**:
```json
{
  "success": true,
  "sessionId": "7388a49d-3ee8-4700-a44b-b537f915e7aa",
  "fixMethod": "elevenlabs_metadata",
  "oldDuration": 420,
  "newDuration": 181,
  "oldStartedAt": "2026-01-19T16:42:38.168Z",
  "newStartedAt": "2026-01-19T16:46:37.168Z",
  "transcriptLength": 42
}
```

**How It Works**:
1. Fetches conversation from ElevenLabs API: `GET /v1/convai/conversations/{conversationId}`
2. Extracts actual duration from `metadata.call_duration_secs`
3. Recalculates `started_at = ended_at - duration`
4. Updates database with accurate timestamps and duration

---

#### Endpoint 3: Batch Fix (Rough Estimates) ⚠️ DEPRECATED
**Path**: `/api/debug/fix-session-durations`
**Method**: POST
**Body**: `{ "email": "user@example.com" }` or `{ "sessionIds": [...] }`

**Note**: Uses rough estimation (10s per message). Prefer using accurate fix endpoint above.

---

### Part 3: Inspection Endpoint (Debug Tool)

**Path**: `/api/debug/inspect-elevenlabs-conversation`
**Method**: GET
**Query Params**: `conversationId`

**Purpose**: Inspect raw ElevenLabs conversation data

**Example**:
```bash
curl "http://localhost:3001/api/debug/inspect-elevenlabs-conversation?conversationId=conv_4401kfbjaetjex6rg87be4yh59em"
```

**Shows**:
- Full metadata (including `call_duration_secs`)
- Transcript preview
- Available fields
- Raw conversation data

---

## Results: Irina's Sessions Fixed ✅

| Session ID | Training Mode | Messages | Old Duration | New Duration (Accurate) | Fix Method |
|-----------|---------------|----------|--------------|------------------------|------------|
| `7388a49d` | Service Practice | 42 | 420s (7m 0s) ❌ | **181s (3m 1s)** ✅ | ElevenLabs metadata |
| `00045c55` | Service Practice | 25 | 250s (4m 10s) ❌ | **156s (2m 36s)** ✅ | ElevenLabs metadata |
| `2b3323e0` | Service Practice | 25 | 250s (4m 10s) ❌ | **145s (2m 25s)** ✅ | ElevenLabs metadata |

**Verification**: Session `7388a49d` now shows **3m 1s** in the UI, matching the audio player's 3:00 display exactly!

---

## Files Modified

### Core Code Changes
1. **`src/hooks/useElevenLabsConversation.ts`**
   - Line ~729: Capture session start time immediately
   - Line ~574, ~590: Preserve accurate start time in recording
   - Line ~850: Add warning for missing start time

### New API Endpoints
2. **`src/app/api/debug/check-session-durations/route.ts`** (NEW)
   - Diagnostic endpoint for checking session durations

3. **`src/app/api/debug/fix-session-durations/route.ts`** (NEW)
   - Batch repair with rough estimation (deprecated)

4. **`src/app/api/debug/fix-session-duration-accurate/route.ts`** (NEW)
   - Single session repair with accurate ElevenLabs data ⭐ **RECOMMENDED**

5. **`src/app/api/debug/inspect-elevenlabs-conversation/route.ts`** (NEW)
   - ElevenLabs conversation data inspector

---

## How to Fix Other Users' Sessions

### Step 1: Check for Issues
```bash
curl "http://localhost:3001/api/debug/check-session-durations?email=user@example.com" | jq .
```

Look for:
- `sessions_with_zero_duration > 0`
- `sessions_needing_fix > 0`

### Step 2: Fix Each Session Accurately
```bash
# Get session IDs from Step 1
SESSION_IDS=("session-id-1" "session-id-2" "session-id-3")

for SESSION_ID in "${SESSION_IDS[@]}"; do
  echo "Fixing session: $SESSION_ID"
  curl -X POST http://localhost:3001/api/debug/fix-session-duration-accurate \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$SESSION_ID\"}" | jq .
done
```

### Step 3: Verify Fix
```bash
curl "http://localhost:3001/api/debug/check-session-durations?email=user@example.com" | jq '.sessions_with_zero_duration'
# Should return 0
```

---

## ElevenLabs API Data Structure

For reference, the accurate duration comes from:

```json
{
  "conversation_id": "conv_...",
  "status": "done",
  "metadata": {
    "call_duration_secs": 181,  // ⭐ THIS IS THE ACCURATE DURATION
    "start_time_unix_secs": 1768841102,
    "termination_reason": "Client disconnected: 1000",
    // ... other metadata
  },
  "transcript": [
    {
      "role": "agent",
      "message": "...",
      "timestamp": 1000,     // milliseconds from start
      "end_timestamp": 2500
    }
    // ... more messages
  ]
}
```

---

## Prevention for Future

### New Sessions
✅ **Automatically prevented** by code fix in `useElevenLabsConversation.ts`

### Monitoring
Add to deployment checklist:
```bash
# Check for any new sessions with 0 duration
curl "http://localhost:3001/api/debug/check-session-durations?email=test@example.com" | \
  jq '.sessions_with_zero_duration'
```

If this returns > 0 after deployment, investigate immediately.

---

## Technical Notes

### Why Timestamps Were Identical

The bug created this scenario:
```typescript
// Session starts at 17:00:00
sessionStartTimeRef.current = undefined  // Never set!

// Session ends at 17:05:00
const endTime = new Date()                    // 17:05:00
const startTime = new Date(undefined || Date.now())  // 17:05:00 (fallback!)

// Result
started_at: "17:05:00"
ended_at:   "17:05:00"
duration:   0 seconds
```

### Why Estimation Was Inaccurate

Conversation dynamics vary greatly:
- Quick responses: 5-10 seconds
- Complex answers: 15-30 seconds
- Pauses/thinking: 2-5 seconds
- User typing time: variable

42 messages ≠ 420 seconds evenly distributed. Actual: 181s with natural conversation flow.

---

## Related Issues

- **Issue**: Employee session history showing incorrect durations
- **Status**: ✅ FIXED
- **Date**: February 7, 2026
- **Reporter**: User noticed irina@4elem.elem sessions showing 0s
- **Fix Author**: Claude Code
- **Testing**: Verified on production data

---

## Future Improvements

1. **Proactive Monitoring**: Add database trigger to alert when `started_at = ended_at`
2. **Automatic Repair**: Run repair script nightly for any sessions with 0 duration
3. **UI Indicator**: Show warning icon if session duration seems incorrect
4. **ElevenLabs Webhook**: Update duration immediately when conversation ends
5. **Validation**: Add database constraint: `duration_seconds > 0 OR transcript IS NULL`

---

## See Also

- **CLAUDE.md** - Main project documentation
- **TROUBLESHOOTING_GUIDE.md** - General debugging guide
- **API_REFERENCE.md** - All API endpoints
- ElevenLabs Conversational AI API: https://elevenlabs.io/docs/api-reference/conversations
