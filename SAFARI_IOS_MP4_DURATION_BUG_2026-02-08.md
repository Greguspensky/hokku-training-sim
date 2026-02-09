# Safari iOS MP4 Duration Metadata Bug
**Date**: 2026-02-08
**Priority**: 🔴 **CRITICAL**
**Status**: ⚠️ **IDENTIFIED** - Fix Pending

---

## Problem Summary

Videos recorded on **iPhone 15 (Safari iOS)** show **corrupted duration** metadata:
- **Expected**: `10m 34s` (634 seconds)
- **Actual Video Metadata**: `1988:34:41` (7,155,881 seconds = ~82.8 days!)
- **Symptoms**: Video cannot be scrubbed/seeked properly, progress bar unusable

### Affected Session
- **Session ID**: `006433b1-5a4a-4b88-bc9e-ba2d75bdb759`
- **Device**: iPhone 15
- **Browser**: Safari (iOS)
- **Training Type**: Situationships (Recommendation/TTS)
- **File Size**: 87 MB
- **Codec**: `video/mp4` (required by Safari iOS)

---

## Root Cause Analysis

### Technical Details

1. **Safari's MediaRecorder Implementation**
   - Safari iOS only supports `video/mp4` codec for MediaRecorder API
   - Creates **fragmented MP4 (fMP4)** files during recording
   - These fMP4 files are written incrementally in chunks (1-second intervals)

2. **The Metadata Problem**
   - Fragmented MP4 files have **two critical atoms**: `MOOV` (metadata) and `MDAT` (actual video data)
   - Safari iOS writes MDAT chunks as recording progresses
   - **Duration metadata in MOOV atom is not finalized** when recording stops
   - Result: Missing or incorrect duration in file metadata

3. **Why 1988:34:41?**
   - Video players try to calculate duration: `fileSize / bitrate = duration`
   - If bitrate metadata is also wrong, calculation produces garbage values
   - Player sees huge file size (87 MB) ÷ incorrect bitrate = nonsense duration

### Verification

**Database has correct duration:**
```
session.recording_duration_seconds = 634  // 10m 34s ✅
```

**MP4 file has wrong duration:**
```
video.duration = 7155881  // 1988:34:41 ❌
```

**Evidence:**
- Screenshot shows: "Длительность записи: 10m 34s" (database value) ✅
- Video player shows: "0:00 / 1988:34:41" (file metadata) ❌

---

## Impact

### User Experience
- ❌ **Cannot scrub/seek** through video timeline
- ❌ **Progress bar broken** - shows incorrect position
- ❌ **Playback controls unreliable** - hard to navigate video
- ⚠️ **Video still plays** but user cannot control position
- ❌ **Download problems** - some players reject corrupted metadata

### Scale
- **All iOS Safari users** affected (iPhone/iPad)
- **Recommendation/TTS training** primarily impacted (uses video recording)
- **Theory Q&A** less affected (audio-only option available)

---

## Technical Investigation

### Current Code Behavior

**File**: `src/services/VideoRecordingService.ts`

```typescript
// Line 368-385: MIME type detection
private getSupportedMimeType(): string {
  const types = [
    'video/mp4',                    // iOS Safari requirement ⚠️
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm'
  ]

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`📹 Using MIME type: ${type}`)
      return type  // Returns 'video/mp4' on Safari iOS
    }
  }
}
```

**Recording Process:**
1. Client records video using `MediaRecorder` with `video/mp4` MIME type
2. Chunks collected every 1 second: `mediaRecorder.start(1000)`
3. Client calculates duration: `Math.round((Date.now() - this.startTime) / 1000)` ✅
4. Duration saved to database correctly ✅
5. MP4 file uploaded to Supabase storage **with broken metadata** ❌

**Display Code:**
`src/app/employee/sessions/[sessionId]/page.tsx` (Line 804-813)

```typescript
<video controls className="w-full rounded-lg">
  <source src={session.video_recording_url} type="video/webm" />
  <source src={session.video_recording_url} type="video/mp4" />
</video>

<span>
  {t('recordingDuration')}:
  {trainingSessionsService.formatDuration(session.recording_duration_seconds || 0)}
  {/* Shows correct database value: 10m 34s ✅ */}
</span>
```

**Issue:** Standard HTML5 `<video>` element reads duration from **file metadata** (broken), not from database (correct).

---

## Solution Options

### Option 1: Server-Side MP4 Repair ⭐ **RECOMMENDED**

**Approach:**
Process uploaded MP4 files server-side to fix duration metadata using `ffmpeg`.

**Implementation:**
1. **Supabase Edge Function** triggered on video upload
2. Download corrupted MP4 from storage
3. Run ffmpeg to re-mux and fix metadata:
   ```bash
   ffmpeg -i input.mp4 -c copy -movflags faststart output.mp4
   ```
4. Replace original file with fixed version
5. Update database with processing status

**Pros:**
- ✅ Fixes issue permanently for all users
- ✅ Works with standard video players
- ✅ No client-side changes needed
- ✅ Backward compatible with existing videos

**Cons:**
- ⚠️ Requires server-side processing (CPU/cost)
- ⚠️ Adds upload latency (1-3 seconds)
- ⚠️ Need ffmpeg in Supabase Edge Functions (Deno environment)

**Files to Create:**
```
supabase/functions/fix-video-duration/index.ts
```

**Estimated Effort:** 4-6 hours

---

### Option 2: Custom Video Player (Client-Side)

**Approach:**
Build custom video player that uses database duration instead of file metadata.

**Implementation:**
```typescript
// VideoPlayerWithDuration.tsx
const VideoPlayerWithDuration = ({
  videoUrl,
  durationSeconds
}: {
  videoUrl: string
  durationSeconds: number
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      // Override video duration with database value
      Object.defineProperty(videoRef.current, 'duration', {
        value: durationSeconds,
        writable: false
      })
    }
  }, [durationSeconds])

  return (
    <video ref={videoRef} controls>
      <source src={videoUrl} type="video/mp4" />
    </video>
  )
}
```

**Pros:**
- ✅ Quick implementation (1-2 hours)
- ✅ No server-side processing
- ✅ Can deploy immediately

**Cons:**
- ❌ Doesn't fix actual MP4 file
- ❌ Downloads still have broken metadata
- ⚠️ Browser compatibility issues (some browsers prevent duration override)
- ❌ Seeking still problematic in some players

**Estimated Effort:** 2-3 hours

---

### Option 3: Client-Side Fix Before Upload

**Approach:**
Use `ffmpeg.wasm` in browser to fix MP4 before uploading.

**Implementation:**
```typescript
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg'

async function fixMP4Duration(blob: Blob): Promise<Blob> {
  const ffmpeg = createFFmpeg({ log: true })
  await ffmpeg.load()

  // Write input file
  ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(blob))

  // Fix metadata
  await ffmpeg.run('-i', 'input.mp4', '-c', 'copy', '-movflags', 'faststart', 'output.mp4')

  // Read output
  const data = ffmpeg.FS('readFile', 'output.mp4')
  return new Blob([data.buffer], { type: 'video/mp4' })
}
```

**Pros:**
- ✅ Fixes file before upload
- ✅ No server-side processing
- ✅ Works with all video players

**Cons:**
- ❌ Heavy browser processing (slow on mobile)
- ❌ Large bundle size (ffmpeg.wasm ~25 MB)
- ❌ May timeout on long videos
- ❌ Drains mobile battery
- ❌ Poor UX on iPhone (the affected device!)

**Estimated Effort:** 6-8 hours

---

### Option 4: Workaround - Store Duration in Database Only

**Approach:**
Accept broken MP4, hide native video controls, show database duration.

**Implementation:**
```typescript
<div className="relative">
  <video ref={videoRef} className="w-full">
    {/* No controls attribute */}
    <source src={videoUrl} type="video/mp4" />
  </video>

  {/* Custom controls using database duration */}
  <div className="custom-controls">
    <button onClick={() => videoRef.current?.play()}>▶️</button>
    <span>{formatTime(currentTime)} / {formatTime(durationSeconds)}</span>
    <input
      type="range"
      min="0"
      max={durationSeconds}
      value={currentTime}
      onChange={(e) => videoRef.current.currentTime = Number(e.target.value)}
    />
  </div>
</div>
```

**Pros:**
- ✅ Fast implementation (2-3 hours)
- ✅ Works reliably
- ✅ No heavy processing

**Cons:**
- ❌ Custom controls maintenance burden
- ❌ Accessibility concerns
- ⚠️ Still doesn't fix downloaded files

**Estimated Effort:** 3-4 hours

---

## Recommended Solution: Option 1 (Server-Side Fix)

### Why Option 1?
1. **Permanent fix** for all users and all scenarios
2. **Best UX** - works with native video players
3. **Backward compatible** - can fix existing videos retroactively
4. **Scalable** - Supabase handles processing infrastructure

### Implementation Plan

#### Phase 1: Supabase Edge Function (Week 1)
```typescript
// supabase/functions/fix-video-duration/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { videoUrl, sessionId } = await req.json()

  // Download video
  const response = await fetch(videoUrl)
  const videoBlob = await response.blob()

  // Fix metadata using ffmpeg
  const fixedBlob = await fixMetadataWithFFmpeg(videoBlob)

  // Upload fixed version
  const supabase = createClient(...)
  await supabase.storage.from('videos').upload(`fixed/${sessionId}.mp4`, fixedBlob)

  return new Response('OK', { status: 200 })
})

async function fixMetadataWithFFmpeg(blob: Blob): Promise<Blob> {
  // Use Deno subprocess to run ffmpeg
  const inputPath = await Deno.makeTempFile({ suffix: '.mp4' })
  const outputPath = await Deno.makeTempFile({ suffix: '.mp4' })

  // Write input
  await Deno.writeFile(inputPath, new Uint8Array(await blob.arrayBuffer()))

  // Run ffmpeg
  const process = Deno.run({
    cmd: [
      'ffmpeg',
      '-i', inputPath,
      '-c', 'copy',
      '-movflags', 'faststart',
      outputPath
    ]
  })

  await process.status()

  // Read output
  const fixed = await Deno.readFile(outputPath)

  // Cleanup
  await Deno.remove(inputPath)
  await Deno.remove(outputPath)

  return new Blob([fixed], { type: 'video/mp4' })
}
```

#### Phase 2: Trigger Function on Upload
```typescript
// Modify VideoRecordingService upload method
async uploadVideo(blob: Blob, sessionId: string): Promise<string> {
  // 1. Upload original video
  const url = await this.supabaseUpload(blob, sessionId)

  // 2. Trigger fix function (async, non-blocking)
  fetch('/api/fix-video-duration', {
    method: 'POST',
    body: JSON.stringify({ videoUrl: url, sessionId })
  }).catch(err => console.error('Failed to trigger video fix:', err))

  return url
}
```

#### Phase 3: Retroactive Fix for Existing Videos
```sql
-- Get all Safari iOS sessions with corrupted videos
SELECT id, video_recording_url, recording_duration_seconds
FROM training_sessions
WHERE video_recording_url IS NOT NULL
  AND recording_preference = 'audio_video'
  AND created_at > '2025-01-01'  -- Only recent videos
  AND recording_duration_seconds < 3600  -- Less than 1 hour
ORDER BY created_at DESC;
```

**Script to fix existing videos:**
```typescript
// scripts/fix-existing-videos.ts
const sessions = await supabase
  .from('training_sessions')
  .select('id, video_recording_url')
  .not('video_recording_url', 'is', null)
  .eq('recording_preference', 'audio_video')

for (const session of sessions.data) {
  await fetch('https://[project].supabase.co/functions/v1/fix-video-duration', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({
      videoUrl: session.video_recording_url,
      sessionId: session.id
    })
  })

  console.log(`✅ Fixed video for session ${session.id}`)
  await new Promise(resolve => setTimeout(resolve, 1000))  // Rate limit
}
```

---

## Testing Plan

### Test Cases

1. **iPhone 15 + Safari iOS**
   - Record 10-minute Recommendation training
   - Check video duration displays correctly
   - Verify seeking/scrubbing works

2. **Android Chrome**
   - Record same training (uses WebM codec)
   - Ensure no regression

3. **Desktop Safari**
   - Test macOS Safari behavior
   - Verify duration correct

4. **Existing Broken Video**
   - Run fix function on session `006433b1-5a4a-4b88-bc9e-ba2d75bdb759`
   - Download fixed video
   - Verify duration: `10:34` not `1988:34:41`

### Validation Checklist
- [ ] Video duration displays as `10:34` not `1988:34:41`
- [ ] Seeking/scrubbing works smoothly
- [ ] Progress bar shows correct position
- [ ] Downloaded video plays correctly in VLC/QuickTime
- [ ] File size remains similar (~87 MB)
- [ ] No quality degradation

---

## Browser Compatibility

### MediaRecorder Codecs by Browser

| Browser | Platform | Codec | Duration Metadata |
|---------|----------|-------|-------------------|
| Safari | iOS | `video/mp4` | ❌ **BROKEN** |
| Safari | macOS | `video/mp4` | ⚠️ Sometimes broken |
| Chrome | Desktop | `video/webm` | ✅ Works |
| Chrome | Android | `video/webm` | ✅ Works |
| Firefox | All | `video/webm` | ✅ Works |
| Edge | Desktop | `video/webm` | ✅ Works |

---

## Known Issues & Workarounds

### Issue: Video Doesn't Play at All
**Workaround:** Re-encode with ffmpeg using H.264 baseline profile
```bash
ffmpeg -i input.mp4 -c:v libx264 -profile:v baseline -c:a aac output.mp4
```

### Issue: Seeking Still Doesn't Work After Fix
**Cause:** Missing keyframes in video
**Workaround:** Re-encode with forced keyframes every 2 seconds
```bash
ffmpeg -i input.mp4 -c copy -force_key_frames "expr:gte(t,n_forced*2)" output.mp4
```

### Issue: Edge Function Timeout
**Cause:** Video too large (>100 MB)
**Workaround:** Increase Edge Function timeout or process asynchronously

---

## Resources

### External References
- [MDN: MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Safari WebKit Bug: MP4 Duration](https://bugs.webkit.org/show_bug.cgi?id=201907)
- [FFmpeg MP4 Fast Start Guide](https://trac.ffmpeg.org/wiki/StreamingGuide)
- [Fragmented MP4 Specification](https://developer.apple.com/documentation/http_live_streaming/about_the_ext-x-version_tag)

### Related Issues
- Similar issue reported by others: [StackOverflow](https://stackoverflow.com/questions/61394357/mediarecorder-api-on-safari-ios-creates-video-with-wrong-duration)

---

## Next Steps

### Immediate Actions (This Week)
1. ⚠️ **Notify affected users** - iOS Safari users may have broken video recordings
2. 🔧 **Implement Option 2** (Custom Player) as temporary fix (2-3 hours)
3. 📝 **Document workaround** for users downloading videos

### Short-Term (Next Sprint)
1. 🏗️ **Implement Option 1** (Server-Side Fix) as permanent solution
2. 🔄 **Retroactively fix** existing broken videos (run script)
3. ✅ **Validate** fix with iPhone 15 user

### Long-Term (Next Quarter)
1. 📊 **Monitor** Safari iOS recordings for quality issues
2. 🎯 **Add metadata validation** on upload to detect future issues early
3. 📱 **Consider alternative** recording methods for iOS (e.g., native APIs)

---

**Status**: ⚠️ **Critical Bug Identified** - Fix Required
**Assignee**: TBD
**Estimated Fix Time**: 4-6 hours (Option 1)
**Last Updated**: 2026-02-08
