# ElevenLabs Transcript Recovery Guide
**Created: 2026-02-11**

## Problem
A training session has an `elevenlabs_conversation_id` but the transcript is empty (0 messages) and assessment cannot run.

## Symptoms
- Session shows duration: 0s (but ElevenLabs shows actual duration like 9:58)
- Transcript section shows "No conversation was recorded"
- Assessment status: pending
- Audio may or may not be uploaded

## Root Cause
The session was created and linked to ElevenLabs conversation, but the transcript was never fetched from ElevenLabs API and saved to the database.

## Recovery Process (2 Steps)

### Step 1: Fetch Transcript from ElevenLabs

**Endpoint:** `POST /api/elevenlabs/elevenlabs-conversation-transcript`

**Request:**
```bash
curl -X POST http://localhost:3000/api/elevenlabs/elevenlabs-conversation-transcript \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "conv_XXXXX"}'
```

**What it does:**
1. Fetches conversation metadata from ElevenLabs
2. Extracts transcript from conversation
3. Formats transcript for database (role, content, timestamp)
4. Finds session by `elevenlabs_conversation_id`
5. Updates session with:
   - `conversation_transcript` (array of messages)
   - `session_duration_seconds` (from ElevenLabs metadata)

**Expected result:**
- Returns: `{"success": true, "messageCount": XX, "durationSeconds": XXX}`
- Session now has transcript and correct duration

### Step 2: Trigger Assessment

**For Theory Sessions:**

**Endpoint:** `POST /api/assessment/assess-theory-session`

**Request:**
```bash
curl -X POST http://localhost:3000/api/assessment/assess-theory-session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "UUID",
    "userId": "UUID"
  }'
```

**For Service Practice Sessions:**

**Endpoint:** `POST /api/assessment/assess-service-practice-session`

**Request:**
```bash
curl -X POST http://localhost:3000/api/assessment/assess-service-practice-session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "UUID"
  }'
```

**What it does:**
1. Reads transcript from database
2. Calls GPT-4 to analyze Q&A exchanges
3. Generates scores and feedback
4. Saves results to `theory_assessment_results` or `service_practice_assessment_results`
5. Updates `assessment_status` to "completed"

**Expected result:**
- Takes 30-120 seconds depending on conversation length
- Returns: `{"success": true, "assessment": {...}}`
- Session now has complete assessment results

### Step 3: Verify Results

Refresh the session page in browser:
```
http://localhost:3000/employee/sessions/{sessionId}
```

**Should now show:**
- ✅ Correct duration (e.g., 9:58 instead of 0s)
- ✅ Full transcript with all Q&A exchanges
- ✅ "Analysis" tab with complete assessment results
- ✅ Scores and feedback for each question

## Quick Reference Script

Save this as `/tmp/recover_session.sh`:

```bash
#!/bin/bash
# Usage: ./recover_session.sh <conversationId> <sessionId> <userId>

CONVERSATION_ID=$1
SESSION_ID=$2
USER_ID=$3

echo "Step 1: Fetching transcript from ElevenLabs..."
curl -X POST http://localhost:3000/api/elevenlabs/elevenlabs-conversation-transcript \
  -H "Content-Type: application/json" \
  -d "{\"conversationId\": \"$CONVERSATION_ID\"}"

echo ""
echo "Step 2: Triggering theory assessment..."
curl -X POST http://localhost:3000/api/assessment/assess-theory-session \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"userId\": \"$USER_ID\"}"

echo ""
echo "Done! Refresh the session page to see results."
```

## Finding Required IDs

### Conversation ID
- Look in session details on the UI
- Or query database: `SELECT elevenlabs_conversation_id FROM training_sessions WHERE id = '<sessionId>'`
- Format: `conv_XXXXX`

### Session ID
- From the URL: `/employee/sessions/{sessionId}`
- UUID format

### User ID
- Query database: `SELECT id FROM users WHERE email = 'user@example.com'`
- Or from session: `SELECT employee_id FROM training_sessions WHERE id = '<sessionId>'`
- UUID format

## Common Issues

### Issue: Transcript endpoint returns 404
**Cause:** ElevenLabs conversation doesn't exist or has expired
**Solution:** Check ElevenLabs dashboard to verify conversation exists

### Issue: Assessment returns "No transcript"
**Cause:** Step 1 wasn't completed or failed
**Solution:** Run Step 1 first, verify transcript was saved

### Issue: Assessment takes too long (>3 minutes)
**Cause:** Very long conversation (15+ minutes) with many Q&A exchanges
**Solution:** Wait longer or check server logs for errors

## Prevention

To avoid this issue in the future:
1. Ensure session completion flow waits for all data to save
2. Add retry logic for transcript fetching
3. Implement auto-recovery for sessions with missing transcripts
4. Add UI indicators when transcript is being fetched

## Related Files

- **Transcript API:** `/src/app/api/elevenlabs/elevenlabs-conversation-transcript/route.ts`
- **Theory Assessment API:** `/src/app/api/assessment/assess-theory-session/route.ts`
- **Service Assessment API:** `/src/app/api/assessment/assess-service-practice-session/route.ts`
- **Session Page:** `/src/app/employee/sessions/[sessionId]/page.tsx`

## Example: Real Recovery

**Session:** c6927770-1296-407c-b629-e299c2020b68
**User:** Софья Борисова (sborisova@cam.cof)
**Conversation:** conv_0101kh6v6dk3fhqb29c7kxpajmz1
**Duration:** 9:58 (598 seconds)
**Training Mode:** Theory Q&A (Russian)

**Commands used:**
```bash
# Step 1: Fetch transcript
curl -X POST http://localhost:3000/api/elevenlabs/elevenlabs-conversation-transcript \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "conv_0101kh6v6dk3fhqb29c7kxpajmz1"}'

# Step 2: Analyze
curl -X POST http://localhost:3000/api/assessment/assess-theory-session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "c6927770-1296-407c-b629-e299c2020b68",
    "userId": "cb39ab60-0b51-4e42-ae9b-400e174a2bcd"
  }'
```

**Result:** ✅ Full transcript fetched (105KB), assessment completed with scores and feedback in Russian

---

**Last Updated:** 2026-02-11
**Status:** Tested and working ✅
