# Transcription Troubleshooting Guide - Recommendation TTS Sessions

## Problem: Empty User Responses in Transcript

When an employee records a Recommendation TTS session but their spoken responses are not transcribed (empty `content` fields), follow this guide.

---

## Quick Diagnosis

### Check Session Data
```bash
curl "http://localhost:3001/api/debug/inspect-session?sessionId=YOUR_SESSION_ID" | jq '.diagnosis'
```

**Expected Output for Transcript Issue**:
```json
{
  "has_conversation_id": false,  // Normal for recommendation_tts
  "has_local_transcript": true,  // Has transcript structure...
  "has_recording": true,         // Video exists
  "transcript_is_placeholder": false,
  "needs_elevenlabs_fetch": false
}
```

**Then check the transcript**:
```bash
curl "http://localhost:3001/api/debug/inspect-session?sessionId=YOUR_SESSION_ID" | \
  jq '.session.conversation_transcript[] | select(.role == "user")'
```

**Problem Indicator**: All user messages have `"content": ""`

---

## Root Cause Analysis

### System Architecture
Recommendation TTS sessions use **two separate audio systems**:

1. **Video Recording** (VideoRecordingService)
   - Captures video + audio for playback
   - Records both TTS questions AND user responses
   - ✅ **This worked** (session has 89s video)

2. **Real-Time Transcription** (useElevenLabsTranscription)
   - Separate audio stream via `getUserMedia()`
   - Streams to ElevenLabs Scribe V2 Realtime WebSocket
   - Converts speech to text in real-time
   - ❌ **This failed** (empty transcript)

**Key Point**: Video recording success ≠ transcription success. They use independent audio streams.

---

## Common Failure Modes

### 1. Microphone Permission Denied ⚠️ **#1 Most Common**

**Symptom**: Video recorded, but all user responses empty

**Cause**:
- Browser requested microphone permission TWICE:
  1. For video recording (granted ✅)
  2. For transcription (denied ❌)
- User clicked "Block" or dismissed permission prompt
- Browser remembered denial for this domain

**How to Verify**:
- Check browser console for errors:
  ```
  NotAllowedError: Permission denied
  getUserMedia: audio permission denied
  ```

**Fix for User**:
1. Click lock icon in browser address bar
2. Change microphone permission to "Allow"
3. Refresh page and retry session

**Fix for Admin**:
- Add clear permission instructions in UI before starting
- Show microphone test/preview before session
- Add permission status indicator

---

### 2. Browser Compatibility Issues

**Symptom**: Works on Chrome, fails on Safari/Firefox

**Cause**:
- Safari: Limited WebRTC support, AudioContext restrictions
- Firefox: Different audio capture behavior
- Mobile browsers: Inconsistent WebSocket support

**Affected Browsers**:
- ❌ Safari < 14.1: No ScriptProcessorNode support
- ❌ iOS Safari: Requires user gesture for AudioContext
- ⚠️ Firefox: May require specific audio codec settings

**How to Verify**:
```javascript
// Browser console
console.log({
  hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
  hasAudioContext: !!window.AudioContext || !!window.webkitAudioContext,
  hasWebSocket: !!window.WebSocket
})
```

**Fix**:
- Recommend Chrome/Edge for best compatibility
- Add browser detection and warning UI
- Consider fallback to HTTP-based transcription (OpenAI Whisper)

---

### 3. ElevenLabs WebSocket Connection Failure

**Symptom**: Transcription starts but never returns text

**Cause**:
- Token generation failed (backend API error)
- WebSocket connection timeout
- ElevenLabs API unreachable (firewall/VPN)
- Session token expired (15-minute limit)

**How to Verify**:
Check browser network tab for:
```
Failed to connect to wss://api.elevenlabs.io/v1/speech-to-text/realtime
WebSocket closed with code 1006 (abnormal closure)
```

**Backend logs**:
```bash
# Check token generation API
curl -X POST http://localhost:3001/api/elevenlabs-stt/token

# Expected: { "success": true, "token": "..." }
# Error: { "error": "..." }
```

**Fix**:
- Verify `ELEVENLABS_API_KEY` is set
- Check API key has `convai_write` permissions
- Test connectivity: `curl https://api.elevenlabs.io/v1/`
- Ensure no VPN/firewall blocking WebSocket connections

---

### 4. Voice Activity Detection (VAD) Threshold Not Met

**Symptom**: User spoke, but transcription returned empty

**Cause**:
- User spoke too quietly (below VAD threshold)
- Background noise confused VAD
- Very short responses (< 200ms)
- Microphone volume too low

**VAD Settings** (in `useElevenLabsTranscription.ts`):
```typescript
vad_threshold: "0.4",              // Voice detection sensitivity (0-1)
vad_silence_threshold_secs: "2.0", // 2 seconds silence = commit
min_speech_duration_ms: "200",     // Minimum 200ms to register
min_silence_duration_ms: "200"
```

**How to Verify**:
- Check browser console for WebSocket messages:
  ```
  📝 Partial transcript: [empty]
  📝 Committed transcript: [empty]
  ```
- If you see "Partial transcript" updates but no "Committed transcript", VAD is the issue

**Fix**:
- Lower `vad_threshold` from 0.4 to 0.3 (more sensitive)
- Reduce `vad_silence_threshold_secs` from 2.0 to 1.5
- Show audio level indicator so user can test volume
- Add "Speak louder" hint if no audio detected after 5 seconds

---

### 5. Wrong Audio Input Device Selected

**Symptom**: Transcription starts but captures wrong source

**Cause**:
- Multiple microphones available (built-in, headset, USB)
- Browser selected wrong default device
- Video recording uses Mic A, transcription uses Mic B

**How to Verify**:
```javascript
// Browser console
navigator.mediaDevices.enumerateDevices().then(devices => {
  console.log(devices.filter(d => d.kind === 'audioinput'))
})
```

**Fix**:
- Add audio input device selector in UI
- Let user test microphone before starting
- Remember user's device preference (localStorage)
- Use same device for both video and transcription:
  ```typescript
  const constraints = {
    audio: { deviceId: selectedDeviceId }
  }
  ```

---

## Prevention Checklist

Add these checks to the UI **before** starting a session:

### Pre-Flight Checks
```typescript
async function preFlightCheck() {
  const checks = {
    permissions: false,
    audioDevices: false,
    websocketConnection: false,
    tokenGeneration: false
  }

  // 1. Check microphone permission
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    checks.permissions = true
    stream.getTracks().forEach(track => track.stop())
  } catch (err) {
    console.error('Microphone permission denied:', err)
  }

  // 2. Check audio devices
  const devices = await navigator.mediaDevices.enumerateDevices()
  const audioInputs = devices.filter(d => d.kind === 'audioinput')
  checks.audioDevices = audioInputs.length > 0

  // 3. Test WebSocket connectivity
  try {
    const ws = new WebSocket('wss://api.elevenlabs.io/v1/speech-to-text/realtime')
    ws.onopen = () => {
      checks.websocketConnection = true
      ws.close()
    }
  } catch (err) {
    console.error('WebSocket connection failed:', err)
  }

  // 4. Test token generation
  try {
    const response = await fetch('/api/elevenlabs-stt/token', { method: 'POST' })
    const data = await response.json()
    checks.tokenGeneration = data.success
  } catch (err) {
    console.error('Token generation failed:', err)
  }

  return checks
}
```

### UI Warnings
Show clear warnings before starting:
```typescript
if (!checks.permissions) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Microphone Access Required</AlertTitle>
      <AlertDescription>
        Please allow microphone access to transcribe your responses.
        Click the lock icon in your browser's address bar to enable.
      </AlertDescription>
    </Alert>
  )
}
```

---

## Manual Recovery

If a session was already recorded without transcripts, the audio is still in the video file.

### Option 1: Extract Audio from Video
```bash
# Download video
VIDEO_URL="https://tscjbpdorbxmbxcqyiri.supabase.co/storage/v1/object/public/..."
curl -o session_video.mp4 "$VIDEO_URL"

# Extract audio track
ffmpeg -i session_video.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 session_audio.wav

# Send to OpenAI Whisper for transcription
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F model="whisper-1" \
  -F file="@session_audio.wav" \
  -F language="ru"
```

### Option 2: Manual Transcript Entry
Create admin UI to:
1. Play video for manager
2. Enter user responses manually
3. Update database:
   ```sql
   UPDATE training_sessions
   SET conversation_transcript = '[
     {"role": "assistant", "content": "Question 1...", "timestamp": 1770202275452},
     {"role": "user", "content": "Manually entered response", "timestamp": 1770202299592}
   ]'::jsonb
   WHERE id = '22fc24df-3a0e-44a5-aa68-dceaad5c08ad';
   ```

---

## Monitoring & Alerts

### Database Query - Find Failed Transcriptions
```sql
-- Find recommendation_tts sessions with empty user responses
SELECT
  s.id,
  s.employee_id,
  s.created_at,
  s.session_duration_seconds,
  jsonb_array_length(s.conversation_transcript) as message_count,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(s.conversation_transcript) msg
    WHERE msg->>'role' = 'user'
    AND (msg->>'content' = '' OR msg->>'content' IS NULL)
  ) as empty_user_responses
FROM training_sessions s
WHERE
  s.training_mode = 'recommendation_tts'
  AND s.created_at > NOW() - INTERVAL '7 days'
  AND s.video_recording_url IS NOT NULL  -- Has video
HAVING (
  SELECT COUNT(*)
  FROM jsonb_array_elements(s.conversation_transcript) msg
  WHERE msg->>'role' = 'user'
  AND (msg->>'content' = '' OR msg->>'content' IS NULL)
) > 0
ORDER BY s.created_at DESC;
```

### Automated Alert (Add to cron)
```bash
#!/bin/bash
# Check for failed transcriptions daily
FAILED_COUNT=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*)
  FROM training_sessions
  WHERE training_mode = 'recommendation_tts'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND video_recording_url IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(conversation_transcript) msg
    WHERE msg->>'role' = 'user' AND msg->>'content' = ''
  )
")

if [ "$FAILED_COUNT" -gt 0 ]; then
  echo "⚠️ WARNING: $FAILED_COUNT recommendation sessions failed transcription in last 24 hours"
  # Send to Slack/email/monitoring system
fi
```

---

## Testing Transcription Health

### Manual Test Script
Create `/api/debug/test-transcription/route.ts`:
```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const results = {
    tokenGeneration: false,
    websocketConnection: false,
    audioCapture: false
  }

  // Test 1: Token generation
  try {
    const tokenResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/elevenlabs-stt/token`, {
      method: 'POST'
    })
    const tokenData = await tokenResponse.json()
    results.tokenGeneration = tokenData.success
  } catch (err) {
    console.error('Token generation test failed:', err)
  }

  // Test 2: WebSocket connectivity
  // (Would need to be done client-side)

  return NextResponse.json({
    success: results.tokenGeneration,
    results,
    message: results.tokenGeneration
      ? 'Transcription system healthy'
      : 'Transcription system has issues'
  })
}
```

**Usage**:
```bash
curl http://localhost:3001/api/debug/test-transcription
```

---

## Related Documentation

- **ELEVENLABS_SCRIBE_V2_MIGRATION_2026-01-14.md** - Migration details
- **REAL_TIME_TRANSCRIPTION_FEATURE.md** - Original OpenAI Whisper implementation
- **TROUBLESHOOTING_GUIDE.md** - General system troubleshooting

---

## Action Items for This Session

For session `22fc24df-3a0e-44a5-aa68-dceaad5c08ad`:

1. **Contact User** (Ксения Летова - letova@jpan.jpan)
   - Ask if they granted microphone permission
   - Ask which browser they used (likely Safari or Firefox)
   - Ask if they heard themselves during recording

2. **Review Video**
   - Download: https://tscjbpdorbxmbxcqyiri.supabase.co/storage/v1/object/public/training-recordings/recordings/video/temp_1770202364152_rscphe-video-1770202364220.mp4
   - Verify user actually spoke responses
   - Check audio levels in video

3. **Extract Audio for Manual Transcription** (if urgent)
   - Use ffmpeg to extract audio
   - Send to OpenAI Whisper API
   - Manually update database

4. **System Improvements**
   - Add pre-flight permission check UI
   - Add audio level indicator during session
   - Add browser compatibility warning
   - Implement automatic retry on transcription failure

---

## Future Enhancements

1. **Fallback Transcription**
   - If ElevenLabs WebSocket fails, automatically fall back to HTTP-based OpenAI Whisper
   - Extract audio from recorded video and transcribe post-session

2. **Better Error Messages**
   - Show specific error to user: "Microphone blocked", "Browser not supported", etc.
   - Provide recovery instructions inline

3. **Automatic Recovery**
   - Detect empty transcripts on save
   - Automatically extract audio from video
   - Transcribe using backup service
   - Update database asynchronously

4. **Health Monitoring Dashboard**
   - Show transcription success rate per day
   - Track failures by browser type
   - Alert on spike in failures

---

**Date**: 2026-02-07
**Issue Reporter**: User noticed session 22fc24df-3a0e-44a5-aa68-dceaad5c08ad had no user transcripts
**Status**: ⚠️ **INVESTIGATION COMPLETE** - Awaiting user feedback and system improvements
