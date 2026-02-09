# Video Recording Failure: Theory Q&A & Service Practice (Safari iOS)
**Date**: 2026-02-08
**Priority**: 🔴 **CRITICAL**
**Status**: ⚠️ **IDENTIFIED** - Fix Required

---

## Problem Summary

Videos are **NOT being saved** for Theory Q&A and Service Practice sessions on **iPhone Safari**, but **ARE being saved** for Situationships (Recommendations) sessions.

### Affected User
- **Device**: iPhone 15
- **Browser**: Safari (iOS)
- **User**: Юрий Конох

### Evidence
**Sessions Completed (No Videos Saved):**
1. Service Practice: "Крышка стакана плохо закрыта, гость проливает горячий кофе" - 3m 56s
2. Service Practice: "Волос в напитке" - 2m 44s

**Sessions Completed (Video Saved):**
- Situationships (Recommendation): Session `006433b1-5a4a-4b88-bc9e-ba2d75bdb759` - 10m 34s ✅

---

## Root Cause Analysis

### Different Components, Different Recording Implementations

| Training Mode | Component | Video Recording | Status |
|---------------|-----------|-----------------|--------|
| **Situationships (Recommendations)** | `RecommendationTTSSession.tsx` | ✅ Uses `useVideoRecording` hook | **WORKS** |
| **Theory Q&A** | `ElevenLabsAvatarSession.tsx` | ⚠️ Uses `VideoRecordingService` directly | **FAILS** |
| **Service Practice** | `ElevenLabsAvatarSession.tsx` | ⚠️ Uses `VideoRecordingService` directly | **FAILS** |

### Code Comparison

**Situationships (WORKS):**
```typescript
// RecommendationTTSSession.tsx (Line 97)
const videoRecording = useVideoRecording({
  aspectRatio: videoAspectRatio,
  enableAudioMixing: true,
  onError: (error) => console.error('Video recording error:', error)
})

await videoRecording.startRecording()  // ✅ Works on Safari
```

**Theory Q&A / Service Practice (FAILS):**
```typescript
// useElevenLabsConversation.ts (Line 586)
await videoService.current.startRecording({
  aspectRatio: videoAspectRatio,
  enableAudioMixing: true,
  videoBitrate: undefined
})

// BUT if this fails...
} catch (error) {
  console.error(`❌ Failed to start ${recordingPreference} recording:`, error);
  setIsRecording(false);  // ⚠️ Error silently swallowed!
}
```

### The Critical Difference

**Line 612 in `useElevenLabsConversation.ts`:**
```typescript
} catch (error) {
  console.error(`❌ Failed to start ${recordingPreference} recording:`, error);
  setIsRecording(false);
  // ❌ NO USER NOTIFICATION!
  // ❌ NO RETRY!
  // ❌ SESSION CONTINUES WITHOUT RECORDING!
}
```

**Result:**
1. User starts Theory Q&A session with video recording selected
2. Safari throws error when requesting camera/microphone (permissions issue, bug, etc.)
3. Error logged to console but **NOT shown to user**
4. `isRecording` set to false
5. Session continues normally
6. User completes session **thinking it was recorded**
7. **No video saved** ❌

---

## Why Does Safari Fail?

### Possible Causes

#### 1. Permissions Not Granted Properly
- User may have denied camera/microphone permissions
- Safari may have blocked request due to:
  - Popup blocker
  - Previous denial cached
  - Cross-origin issues
  - Insecure context

#### 2. Safari MediaRecorder Limitations
- Safari iOS has strict MediaRecorder requirements
- May require specific codec/format
- May fail if constraints are too restrictive

#### 3. Timing Issue
- Recording starts too early (before user interaction)
- Safari requires user gesture to request permissions
- ElevenLabs initialization may interfere

#### 4. Missing Device Check
- Recommendations has `DeviceCheckPage` before recording starts
- Theory Q&A / Service Practice may skip device check
- User never gets chance to grant permissions

---

## Verification Steps

### Check Browser Console (User's iPhone)

**If recording fails, console should show:**
```
❌ Failed to start audio_video recording: NotAllowedError: Permission denied
```

**Or:**
```
❌ Failed to start audio_video recording: NotFoundError: No camera found
```

**Or:**
```
❌ Failed to start audio_video recording: NotSupportedError: Type not supported
```

### Check Session Flow

**Recommendations (WORKS):**
1. User selects recording preference ✅
2. `DeviceCheckPage` shown ✅
3. User clicks "Request Camera Access" ✅
4. Browser shows permission dialog ✅
5. User grants permissions ✅
6. Recording starts successfully ✅

**Theory Q&A / Service Practice (FAILS):**
1. User selects recording preference ✅
2. `DeviceCheckPage` shown? ⚠️ **NEED TO VERIFY**
3. Permission requested? ⚠️ **MAYBE SKIPPED**
4. Recording fails silently ❌
5. Session continues without video ❌

---

## Solution Options

### Option 1: Add User Notification When Recording Fails ⭐ **QUICK FIX**

**File**: `src/hooks/useElevenLabsConversation.ts` (Line 610-613)

**Current Code:**
```typescript
} catch (error) {
  console.error(`❌ Failed to start ${recordingPreference} recording:`, error);
  setIsRecording(false);
}
```

**Fixed Code:**
```typescript
} catch (error) {
  console.error(`❌ Failed to start ${recordingPreference} recording:`, error);
  setIsRecording(false);
  setError(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);

  // Show alert to user
  alert(
    'Video recording failed to start. The session will continue without recording. ' +
    'Please check your camera/microphone permissions in Safari settings.'
  );
}
```

**Pros:**
- ✅ Quick fix (5 minutes)
- ✅ User immediately knows recording failed
- ✅ Session continues but user is informed

**Cons:**
- ⚠️ Alert dialog is intrusive
- ❌ Doesn't fix the root cause
- ❌ User can't retry

**Effort:** 5-10 minutes

---

### Option 2: Add Device Check for Theory Q&A / Service Practice ⭐ **RECOMMENDED**

**Problem:** Theory Q&A and Service Practice might not show `DeviceCheckPage` before starting session.

**Solution:** Ensure `DeviceCheckPage` is shown for ALL session types when `recordingPreference !== 'none'`.

**File**: `src/app/employee/training/[assignmentId]/page.tsx`

**Add device check flow:**
```typescript
// Show device check page after recording consent
{showDeviceCheck && (
  <DeviceCheckPage
    recordingPreference={recordingPreference}
    videoAspectRatio={videoAspectRatio}
    onComplete={handleDeviceCheckComplete}
    onBack={handleDeviceCheckBack}
  />
)}
```

**Verify this exists for:**
- ✅ Recommendations (already has it)
- ⚠️ Theory Q&A (needs verification)
- ⚠️ Service Practice (needs verification)

**Pros:**
- ✅ Proper permission flow
- ✅ User explicitly grants permissions
- ✅ Validates devices work before session
- ✅ Consistent UX across all modes

**Cons:**
- ⚠️ Adds extra step to flow
- ⚠️ Need to verify current implementation

**Effort:** 1-2 hours (if not implemented)

---

### Option 3: Retry Recording on Failure

**Add retry logic when recording fails:**

```typescript
} catch (error) {
  console.error(`❌ Failed to start ${recordingPreference} recording:`, error);
  setIsRecording(false);

  // Show retry dialog
  const retry = window.confirm(
    'Video recording failed to start. This may be due to permissions. ' +
    'Would you like to try again? (Click Cancel to continue without recording)'
  );

  if (retry) {
    // Retry after 1 second
    setTimeout(async () => {
      try {
        await startSessionRecording();
      } catch (retryError) {
        alert('Recording failed again. Continuing without recording.');
      }
    }, 1000);
  }
}
```

**Pros:**
- ✅ Gives user chance to fix permissions
- ✅ May succeed on second attempt

**Cons:**
- ⚠️ Still intrusive with dialogs
- ⚠️ May fail again if permissions issue

**Effort:** 30 minutes

---

### Option 4: Graceful Degradation with Banner Warning

**Show persistent warning banner if recording fails:**

**Add to `ElevenLabsAvatarSession.tsx`:**
```typescript
{error && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
    <div className="flex">
      <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
      <div>
        <p className="text-sm text-yellow-700">
          ⚠️ <strong>Video recording failed to start.</strong>
        </p>
        <p className="text-sm text-yellow-600 mt-1">
          {error}
        </p>
        <p className="text-xs text-yellow-500 mt-2">
          Your session will be saved, but without video.
          Check Safari settings → {window.location.hostname} → Camera & Microphone.
        </p>
      </div>
    </div>
  </div>
)}
```

**Pros:**
- ✅ Non-intrusive
- ✅ Clear explanation
- ✅ User can continue or stop
- ✅ Professional UX

**Cons:**
- ⚠️ User might miss the warning

**Effort:** 30-45 minutes

---

## Recommended Implementation

### Phase 1: Immediate Fix (30 minutes)
**Combine Option 1 + Option 4:**
1. Add error alert when recording fails
2. Add persistent warning banner
3. Let session continue with warning visible

### Phase 2: Proper Fix (1-2 hours)
**Option 2: Verify Device Check Flow**
1. Check if `DeviceCheckPage` is shown for Theory Q&A
2. Check if `DeviceCheckPage` is shown for Service Practice
3. If missing, add device check step
4. Ensure permissions requested before session starts

### Phase 3: Enhancement (Later)
**Add retry mechanism and better error messages**

---

## Testing Plan

### Test Case 1: Theory Q&A with Video (Safari iOS)
1. **Setup:** iPhone 15 + Safari
2. **Steps:**
   - Start Theory Q&A session
   - Select "Audio + Video Recording"
   - **Verify:** DeviceCheckPage shown
   - **Verify:** Permission buttons visible
   - Click "Request Camera Access"
   - **Verify:** Browser shows permission dialog
   - Grant permissions
   - Start session
   - **Expected:** Video preview visible, recording icon shown
   - Complete session
   - **Expected:** Video saved and playable

### Test Case 2: Service Practice with Video (Safari iOS)
1. Same as Test Case 1 but with Service Practice mode

### Test Case 3: Recording Failure (Simulate)
1. **Setup:** iPhone 15 + Safari, deny camera permissions in Settings
2. **Steps:**
   - Start Theory Q&A with video recording
   - Click "Request Camera Access"
   - **Expected:** Error shown immediately
   - **Expected:** Warning banner visible
   - **Expected:** Session does NOT start until user fixes permissions OR cancels recording

---

## Monitoring & Prevention

### Add Telemetry
**Track recording failures:**
```typescript
// Add to catch block
console.error(`❌ Recording failure:`, {
  mode: 'theory' | 'service_practice',
  error: error.message,
  browser: navigator.userAgent,
  recordingPreference,
  timestamp: new Date().toISOString()
});

// Send to analytics
analytics.track('recording_failure', {
  training_mode: 'theory',
  error_type: error.name,
  platform: 'safari_ios'
});
```

### User-Facing Status
**Add recording status indicator:**
- 🔴 Recording (actively recording)
- ⚠️ Recording Failed (error occurred)
- ⏸️ Recording Paused (if implemented)
- ✅ Recording Saved (after upload)

---

## Related Issues

- `DEVICE_CHECK_IMPLEMENTATION_2026-02-08.md` - Device permission system
- `SAFARI_IOS_MP4_DURATION_BUG_2026-02-08.md` - Safari video metadata bug

---

## Next Steps

### Immediate (Today)
1. ✅ Verify: Does Theory Q&A show `DeviceCheckPage`?
2. ✅ Verify: Does Service Practice show `DeviceCheckPage`?
3. ⚠️ **Add error alert** when recording fails (5 minutes)
4. ⚠️ **Add warning banner** for recording failures (30 minutes)

### Short-Term (This Week)
1. If device check missing → Add `DeviceCheckPage` flow
2. Test on iPhone 15 + Safari
3. Add telemetry for recording failures

### Long-Term (Next Sprint)
1. Add retry mechanism
2. Better error messages with troubleshooting steps
3. Consider fallback to audio-only if video fails

---

**Status**: ⚠️ **Critical Bug - User Confusion**
**Impact**: Users think sessions are recorded but videos are missing
**Priority**: Fix Immediately
**Estimated Fix Time**: 30 minutes (quick fix) + 1-2 hours (proper fix)
**Last Updated**: 2026-02-08
