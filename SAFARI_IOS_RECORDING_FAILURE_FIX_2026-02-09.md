# Safari iOS Video Recording Failure Fix (Theory Q&A / Service Practice)
**Date**: 2026-02-09
**Priority**: 🔴 **CRITICAL**
**Status**: ✅ **FIXED**

---

## Problem Summary

Videos were **NOT being saved** for Theory Q&A and Service Practice sessions on **iPhone Safari**, but **sessions were completing successfully** and being saved to the database.

### Test Case
- **Device**: iPhone 15
- **Browser**: Safari (iOS)
- **Session ID**: `83a408e5-354c-4c3d-a05e-3cb049e4d708`
- **Result**: ✅ Session saved, ✅ ElevenLabs conversation linked, ❌ Video NOT saved

---

## Root Cause

### Behavior Mismatch Between Training Modes

| Training Mode | Component | Recording Failure Behavior | Session Start |
|---------------|-----------|---------------------------|---------------|
| **Recommendations** | `RecommendationTTSSession.tsx` | ❌ **Blocks session** → User stays on "Start" screen | **Prevented** ✅ |
| **Theory Q&A** | `useElevenLabsConversation.ts` | ⚠️ **Swallows error** → Session continues without video | **Allowed** ❌ |
| **Service Practice** | `useElevenLabsConversation.ts` | ⚠️ **Swallows error** → Session continues without video | **Allowed** ❌ |

### Code Comparison

**Recommendations (Correct Behavior):**
```typescript
// RecommendationTTSSession.tsx (Line 381-384)
} catch (error) {
  console.error('❌ Failed to start recording:', error)
  alert(`Failed to start video recording: ${error instanceof Error ? error.message : 'Unknown error'}`)
  throw error // ✅ Re-throw to prevent session from starting
}
```

**Theory/Service Practice (Buggy Behavior - BEFORE FIX):**
```typescript
// useElevenLabsConversation.ts (Line 610-625)
} catch (error) {
  console.error(`❌ Failed to start ${recordingPreference} recording:`, error);
  setIsRecording(false);
  alert('⚠️ Video recording failed to start...');
  // ❌ NO RE-THROW - session continues!
}
```

### What Was Happening

1. User starts Theory Q&A session with video recording
2. `startSessionRecording()` is called
3. Safari throws error when requesting camera/microphone (unknown reason)
4. Error caught by catch block
5. Alert shown to user (after 2026-02-08 fix)
6. **Session continues anyway** ❌
7. User completes session thinking it was recorded
8. Session saved WITHOUT video
9. Database shows: `video_recording_url: NULL` ❌

---

## The Fix

### Change 1: Block Session Start on Recording Failure

**File**: `src/hooks/useElevenLabsConversation.ts` (Line 610-630)

**BEFORE:**
```typescript
} catch (error) {
  console.error(`❌ Failed to start ${recordingPreference} recording:`, error);
  setIsRecording(false);
  setError(`Recording failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`);

  alert('⚠️ Video recording failed to start...');
  // Session continues without recording
}
```

**AFTER:**
```typescript
} catch (error) {
  console.error(`❌ Failed to start ${recordingPreference} recording:`, error);
  setIsRecording(false);
  setError(`Recording failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`);

  alert(
    '⚠️ Video recording failed to start.\n\n' +
    'Possible causes:\n' +
    '• Camera/microphone permissions denied\n' +
    '• No camera/microphone detected\n' +
    '• Browser compatibility issue\n\n' +
    'Please check Safari Settings → ' + (typeof window !== 'undefined' ? window.location.hostname : 'this site') + ' → Camera & Microphone\n\n' +
    'The session will NOT start until recording is fixed.'
  );

  // ✅ Re-throw to prevent session from starting
  throw error;
}
```

**Impact:**
- ✅ Session **will NOT start** if recording fails
- ✅ User stays on "Start Session" screen
- ✅ User can retry after fixing permissions/device issues
- ✅ **No more incomplete sessions without videos**

---

### Change 2: Enhanced Safari iOS Debugging

**File**: `src/services/VideoRecordingService.ts` (Line 290-325)

Added detailed logging for Safari iOS getUserMedia flow:

```typescript
if (isMobile) {
  console.log('📱 Mobile: Requesting video and audio separately')
  console.log('🔍 User Agent:', navigator.userAgent)
  console.log('🔍 Is Safari iOS:', /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent))

  try {
    console.log('📹 Step 1/2: Requesting video stream...')
    const videoStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
    console.log('✅ Video stream obtained:', videoStream.getVideoTracks()[0].getSettings())

    console.log('🎤 Step 2/2: Requesting audio stream...')
    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    console.log('✅ Audio stream obtained:', audioStream.getAudioTracks()[0].getSettings())

    // ... combine streams ...
  } catch (err) {
    console.error('❌ Safari iOS getUserMedia failed:', err)
    console.error('❌ Error name:', (err as Error).name)
    console.error('❌ Error message:', (err as Error).message)

    // Check permission status
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName })
        const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        console.error('🔍 Camera permission:', cameraStatus.state)
        console.error('🔍 Microphone permission:', micStatus.state)
      } catch (permErr) {
        console.error('⚠️ Could not query permissions (Safari limitation)')
      }
    }

    throw err
  }
}
```

**Benefits:**
- 🔍 Detailed logs showing WHICH step fails (video or audio)
- 🔍 Permission state logging (if available)
- 🔍 Error name and message captured
- 🔍 Device settings logged on success

---

## Testing Instructions

### Test Case 1: Normal Flow (Permissions Granted)

1. **Setup**: iPhone with Safari, permissions already granted
2. **Steps**:
   - Go to Theory Q&A session
   - Select "Audio + Video Recording"
   - Click "Start Session"
3. **Expected**:
   - ✅ Recording starts successfully
   - ✅ Video preview shown
   - ✅ Session runs normally
   - ✅ Video saved after session

### Test Case 2: Recording Failure (Permissions Denied)

1. **Setup**: iPhone with Safari, deny camera permission in Settings
2. **Steps**:
   - Go to Theory Q&A session
   - Select "Audio + Video Recording"
   - Click "Start Session"
3. **Expected**:
   - ❌ Alert shown: "Video recording failed to start..."
   - ❌ Session DOES NOT START
   - ✅ User stays on "Start Session" screen
   - ✅ Can retry after fixing permissions
   - ✅ **No incomplete session saved**

### Test Case 3: Recording Failure (No Camera)

1. **Setup**: iPhone with Safari, no camera available (simulated)
2. **Steps**:
   - Go to Theory Q&A session
   - Select "Audio + Video Recording"
   - Click "Start Session"
3. **Expected**:
   - ❌ Alert shown with detailed error
   - ❌ Session blocked
   - ✅ Console shows: "❌ Safari iOS getUserMedia failed: NotFoundError: No camera found"

---

## Console Logs to Check (iPhone Safari)

Open Safari Web Inspector on Mac → Connect to iPhone → Check Console:

**Successful Recording Start:**
```
📱 Mobile: Requesting video and audio separately
🔍 User Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...
🔍 Is Safari iOS: true
📹 Step 1/2: Requesting video stream...
✅ Video stream obtained: {width: 1280, height: 720, facingMode: "user"}
🎤 Step 2/2: Requesting audio stream...
✅ Audio stream obtained: {sampleRate: 48000, channelCount: 1}
✅ Both streams combined successfully
🎬 VideoRecordingService: Starting recording
✅ Video recording started successfully
```

**Recording Failure:**
```
📱 Mobile: Requesting video and audio separately
🔍 User Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...
🔍 Is Safari iOS: true
📹 Step 1/2: Requesting video stream...
❌ Safari iOS getUserMedia failed: NotAllowedError: Permission denied
❌ Error name: NotAllowedError
❌ Error message: Permission denied
🔍 Camera permission: denied
❌ Failed to start audio_video recording: NotAllowedError: Permission denied
```

---

## Next Steps

### If Recording Still Fails After Fix

If users still report recording failures on Safari iOS:

1. **Check Console Logs**: Use Safari Web Inspector to see exact error
2. **Verify Permissions**: Settings → Safari → [Site] → Camera/Microphone
3. **Test DeviceCheckPage**: Ensure DeviceCheckPage is shown and working
4. **Check MediaRecorder Support**: Safari 14.5+ required for MP4 recording
5. **Test getUserMedia**: Verify both video and audio streams are obtained

### Potential Safari-Specific Issues

1. **Security Context**: getUserMedia requires HTTPS (or localhost)
2. **User Gesture**: Must be called from button click (already implemented)
3. **Permission Expiry**: Safari may reset permissions between page loads
4. **MediaRecorder Codec**: Safari only supports MP4 (not WebM)
5. **AudioContext State**: Must be resumed after user gesture

---

## Related Documentation

- **VIDEO_RECORDING_FAILURE_THEORY_SERVICEPRACTICE_2026-02-08.md** - Original investigation
- **DEVICE_CHECK_IMPLEMENTATION_2026-02-08.md** - Device permission system
- **SAFARI_IOS_MP4_DURATION_BUG_2026-02-08.md** - Safari video metadata bug

---

## Files Modified

1. **`src/hooks/useElevenLabsConversation.ts`** (Line 610-630)
   - Added `throw error` to block session start on recording failure
   - Updated alert message with clearer instructions

2. **`src/services/VideoRecordingService.ts`** (Line 290-360)
   - Enhanced Safari iOS logging
   - Added step-by-step getUserMedia debugging
   - Added permission status checking

---

**Status**: ✅ **DEPLOYED** (Build successful)
**Last Updated**: 2026-02-09
**Next Test**: User should test on iPhone Safari and check console logs
