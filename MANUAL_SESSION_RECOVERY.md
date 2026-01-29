# Manual Session Recovery Guide

## Overview
This guide explains how to manually attach ElevenLabs conversation data to training sessions that didn't properly save the conversation ID. This typically happens for sessions that were created before the timer expiration fix was implemented.

## When to Use This Guide
- Session shows "0 messages" in the employee history
- Session page shows "No Recording" despite having an ElevenLabs conversation
- Session ended but didn't save the conversation ID (timer expiration issue)

## Prerequisites
- Access to Supabase SQL Editor
- ElevenLabs conversation ID (format: `conv_XXXXXXXXXXXXXXXXXXXX`)
- Session ID (UUID format)
- Session duration in seconds (from ElevenLabs dashboard)

## Step-by-Step Recovery Process

### Step 1: Update Session with Conversation ID

Run this SQL in Supabase SQL Editor:

```sql
UPDATE training_sessions
SET
  elevenlabs_conversation_id = 'conv_XXXXXXXXXXXXXXXXXXXX',  -- Replace with actual conversation ID
  session_duration_seconds = 41,  -- Replace with actual duration in seconds
  ended_at = started_at + interval '41 seconds',  -- Match duration
  recording_preference = 'audio',  -- Enable audio/transcript fetching
  conversation_transcript = jsonb_build_array(
    jsonb_build_object(
      'role', 'assistant',
      'content', 'Training session completed - use Get Transcript and Analysis button to fetch results',
      'timestamp', extract(epoch from now()) * 1000
    )
  )
WHERE id = 'SESSION-UUID-HERE';  -- Replace with actual session ID
```

### Step 2: Verify the Update

```sql
SELECT
  id,
  elevenlabs_conversation_id,
  recording_preference,
  audio_recording_url,
  session_duration_seconds,
  jsonb_array_length(conversation_transcript) as transcript_messages
FROM training_sessions
WHERE id = 'SESSION-UUID-HERE';
```

**Expected results:**
- `elevenlabs_conversation_id`: Should show the conversation ID
- `recording_preference`: Should be 'audio'
- `session_duration_seconds`: Should match the duration you set
- `transcript_messages`: Should be 1 (placeholder message)

### Step 3: Fetch Full Transcript and Audio

1. Navigate to the session page:
   ```
   http://localhost:3000/employee/sessions/SESSION-UUID-HERE
   ```

2. You should now see the **"Get Transcript and Analysis"** button

3. Click the button to fetch:
   - Full conversation transcript with timestamps (format: "0:23", "0:38", etc.)
   - Audio recording from ElevenLabs
   - Updates the database automatically

### Step 4: Verify Recovery

After clicking "Get Transcript and Analysis":

1. **Transcript Tab**: Should show all messages with timestamps
2. **Audio Section**: Should show playable audio player
3. **Employee History**: Should show correct message count (e.g., "11 messages")

## Example: Real Recovery Case

**Problem Session:**
- Session ID: `84b0aabd-0e29-4eb4-9345-6b52bcc5f0a1`
- ElevenLabs Conv ID: `conv_1901kfxf0nemeyka18ssjq32yj0c`
- Duration: 41 seconds
- Status: Showed "0 messages" and "No Recording"

**SQL Applied:**
```sql
UPDATE training_sessions
SET
  elevenlabs_conversation_id = 'conv_1901kfxf0nemeyka18ssjq32yj0c',
  session_duration_seconds = 41,
  ended_at = started_at + interval '41 seconds',
  recording_preference = 'audio',
  conversation_transcript = jsonb_build_array(
    jsonb_build_object(
      'role', 'assistant',
      'content', 'Training session completed - use Get Transcript and Analysis button to fetch results',
      'timestamp', extract(epoch from now()) * 1000
    )
  )
WHERE id = '84b0aabd-0e29-4eb4-9345-6b52bcc5f0a1';
```

**Result:**
- Session page now shows "Get Transcript and Analysis" button
- Clicking button fetches full transcript with 11 messages
- Audio recording becomes available for playback
- Timestamps appear on each message (0:00, 0:15, 0:23, etc.)

## Common Issues

### Issue 1: Button Still Not Showing
**Cause:** Browser cache or page not refreshed
**Solution:** Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)

### Issue 2: "Transcript Not Ready" Error
**Cause:** ElevenLabs hasn't finished processing the conversation
**Solution:** Wait 1-2 minutes and try again

### Issue 3: Audio Fetch Fails
**Cause:** ElevenLabs conversation might be too old (30-day retention)
**Solution:** Check ElevenLabs dashboard to verify conversation still exists

### Issue 4: Wrong Duration Displayed
**Cause:** Incorrect `session_duration_seconds` in SQL
**Solution:** Check ElevenLabs dashboard for accurate duration, then update:
```sql
UPDATE training_sessions
SET session_duration_seconds = CORRECT_DURATION
WHERE id = 'SESSION-UUID-HERE';
```

## Fields Explanation

### `elevenlabs_conversation_id`
- Format: `conv_` followed by 32 characters
- Source: ElevenLabs dashboard > Conversation > Overview tab
- Purpose: Links session to ElevenLabs conversation for transcript/audio fetching

### `recording_preference`
- Values: `'none'`, `'audio'`, `'audio_video'`
- Impact: Controls whether UI shows recording/transcript fetch options
- Fix value: `'audio'` (enables transcript and audio fetching)

### `conversation_transcript`
- Format: JSONB array of message objects
- Structure: `[{role, content, timestamp}, ...]`
- Initial value: Single placeholder message telling user to fetch transcript
- Final value: Full conversation with timestamps after fetching

### `session_duration_seconds`
- Type: INTEGER
- Source: ElevenLabs dashboard or calculated from timestamps
- Purpose: Display duration in UI and analytics

## Prevention

This issue has been fixed in the codebase as of 2026-01-26:
- Timer expiration now properly calls `stopSession()` to save conversation ID
- Uses refs to prevent stale closure issues
- Both Theory Q&A and Service Practice sessions are covered

**Affected code:**
- `/src/hooks/useTrainingSession.ts` - Timer expiration callback
- `/src/components/Training/ElevenLabsAvatarSession.tsx` - Session lifecycle management
- `/src/hooks/useElevenLabsConversation.ts` - Conversation state management

Sessions created **after** this fix will not require manual recovery.

## Related Documentation
- `ELEVENLABS_SCRIBE_V2_MIGRATION_2026-01-14.md` - ElevenLabs integration details
- `VIDEO_RECORDING_SYSTEM_DOCUMENTATION.md` - Recording system architecture
- `TROUBLESHOOTING_GUIDE.md` - General troubleshooting

## Support
If you encounter issues not covered in this guide:
1. Check browser console for error messages
2. Verify ElevenLabs API key is valid and has `convai_read` permissions
3. Confirm conversation exists in ElevenLabs dashboard (30-day retention)
4. Check Supabase logs for API errors
