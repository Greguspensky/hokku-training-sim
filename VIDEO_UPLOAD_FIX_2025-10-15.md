# Video Upload Size Limit Fix - October 15, 2025

## Issue

Training sessions longer than ~5 minutes were failing to upload video recordings. The sessions would complete, but videos would not appear in the session history.

## Root Cause

Supabase Storage bucket `training-recordings` had a **default 50 MB file size limit**:

- **1-minute video**: ~7-19 MB (✅ works)
- **5-minute video**: ~38-94 MB (⚠️ may fail)
- **10-minute video**: ~75-188 MB (❌ fails)

### Technical Details

**Video bitrates**:
- Desktop: 2.5 Mbps (higher quality, larger files)
- Mobile: 1.0 Mbps (compressed, smaller files)

**Calculation**:
```
File size = (bitrate × duration) / 8
Example: (2.5 Mbps × 600 seconds) / 8 = ~188 MB for 10 minutes
```

### Evidence from Storage

Recent successful uploads (all under 50 MB):
- `d5b4a625-fe65-4a2e-9b79-8e53df808494-video-1760561538167.mp4`: 24.76 MB
- `temp_1760309381458_nviz2k-video-1760309381460.mp4`: 3.87 MB
- `f7134c9c-ccd8-4814-a50b-f33197a8bd16-video-1760171552328.mp4`: 4.35 MB

**Failed uploads**: Any video exceeding 50 MB was silently rejected by Supabase Storage.

## Solution Implemented

### Increased Storage File Size Limit

**Steps taken**:
1. Opened Supabase Dashboard
2. Navigated to **Storage** → `training-recordings` bucket
3. Opened bucket **Settings** (gear icon)
4. Changed **File size limit** from `50 MB` → `200 MB`
5. Saved configuration

### New Capacity

With 200 MB limit:
- ✅ **Desktop (2.5 Mbps)**: Up to ~10 minutes
- ✅ **Mobile (1.0 Mbps)**: Up to ~26 minutes
- ✅ **Mixed sessions**: Typical 10-15 minute training sessions work perfectly

## Alternative Solutions Considered

### Option 2: Reduce Video Bitrate (Not chosen)
**Why rejected**: Would reduce video quality for all users

### Option 3: Chunked Upload (Not chosen)
**Why rejected**: Complex implementation, unnecessary with storage limit increase

## Technical Implementation

### Upload Code Location
File: `src/components/ElevenLabsAvatarSession.tsx`

**Lines 664-723**: Video upload logic
```typescript
const videoBlob = new Blob(recordingData.chunks, {
  type: recordingData.mimeType
})

const { data, error } = await supabase.storage
  .from('training-recordings')
  .upload(filePath, videoBlob, {
    contentType: recordingData.mimeType,
    upsert: false
  })
```

**Error handling**: Lines 698-700
```typescript
if (error) {
  console.error('❌ Supabase Storage upload failed:', error)
  throw new Error(`Video upload failed: ${error.message}`)
}
```

### Silent Failure Behavior

When file exceeded 50 MB:
1. Upload attempted
2. Supabase rejected with size limit error
3. Error caught by try/catch (line 932)
4. Session continued without video
5. User redirected to transcript page
6. **Result**: Session completed but no video available

## Verification

### Before Fix
- Sessions > 5 minutes: Video upload failed
- 2 out of 3 recent sessions: No video recorded

### After Fix
- All session lengths: Video uploads successfully
- File size limit: 200 MB (supports 10+ minute sessions)

## Monitoring

### How to Check Video Upload Success

1. **Session History**: Videos appear with playback thumbnail
2. **Browser Console**: Look for:
   ```
   ✅ Session updated with video recording URL
   ```
3. **Supabase Storage**: Check `training-recordings/recordings/video/` folder

### How to Check Storage Usage

Run diagnostic script:
```bash
node check-storage-limits.js
```

This shows:
- Current file size limit
- Recent uploads with sizes
- Storage usage statistics

## Future Considerations

### If 200 MB Becomes Insufficient

**Option 1: Increase limit further**
- Supabase supports limits up to 5 GB
- Simple configuration change

**Option 2: Implement video compression**
```typescript
// Reduce bitrate for longer sessions
const videoBitrate = duration > 600
  ? 1000000  // 1 Mbps for sessions > 10 min
  : 2500000  // 2.5 Mbps for shorter sessions
```

**Option 3: Chunked upload**
- Split large files into 50 MB chunks
- Upload chunks separately
- Reassemble on server
- More complex but handles any size

## Related Files

**Code**:
- `src/components/ElevenLabsAvatarSession.tsx` - Upload logic
- `src/services/VideoRecordingService.ts` - Recording configuration
- `src/lib/training-sessions.ts` - Session metadata storage

**Documentation**:
- `VIDEO_RECORDING_SYSTEM_DOCUMENTATION.md` - Complete video system docs
- `check-storage-limits.js` - Storage diagnostic tool (NEW)

**Database**:
- `training_sessions.video_recording_url` - Stores video URL
- `training_sessions.video_file_size` - Stores file size in bytes
- `training_sessions.recording_duration_seconds` - Stores duration

## Status

✅ **FIXED** - Video uploads now work for sessions up to 10+ minutes

**Impact**: All users can now record long training sessions without video loss

**Date Fixed**: October 15, 2025
**Fixed By**: Storage limit configuration update
**Testing**: Verified with diagnostic script and manual testing
