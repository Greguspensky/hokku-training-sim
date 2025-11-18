# Speech Emotion Recognition - Research & Implementation Guide
**Date**: 2025-11-18
**Status**: 📋 Research Complete - Awaiting Implementation Decision

## Executive Summary

This document contains research findings for adding **speech emotion recognition** to the Hokku Training Sim platform. Currently, the system analyzes training sessions based on text transcripts only, missing crucial paralinguistic information like emotional tone, speaking volume, pitch, hesitation, and confidence level.

**Business Value**: Emotion analysis would provide deeper insights into employee performance during Service Practice and Theory Q&A sessions, detecting stress, empathy authenticity, confidence levels, and emotional control.

**Estimated Cost**: ~$0.05-0.08 per session analysis
**Processing Time**: 45-90 seconds per session (asynchronous)

---

## Current System Architecture

### Audio Recording System (`VideoRecordingService.ts`)

**How it works**:
- Uses Web Audio API `AudioContext` for real-time audio mixing
- **User microphone** + **ElevenLabs AI agent audio** → mixed into single stream
- Recording formats: WebM (default), MP4 (iOS Safari fallback)
- Storage: Supabase Storage bucket `training-recordings`

**Critical Limitation**:
```
User audio is NOT separated from AI audio during recording.
To analyze user emotion, we must either:
1. Use AI voice separation (post-processing)
2. Modify architecture to record separate tracks
```

### Current Assessment System (`/api/assess-service-practice-session`)

**What it analyzes** (GPT-4o-mini):
- ✅ Text transcript only
- ✅ 8 metrics: Empathy, Professionalism, Problem Resolution, Clarity, De-escalation, Product Knowledge
- ✅ Behavioral metrics: Response time, session duration, turn balance
- ❌ **No vocal tone analysis**
- ❌ **No emotional state detection**
- ❌ **No stress/confidence indicators**

**Caching**: Results stored in `training_sessions.service_practice_assessment_results` (JSONB)

---

## Speech Emotion Recognition (SER) - What Can Be Analyzed

### Emotional Tone Detection
- **Emotions**: Calm, anxious, confident, frustrated, empathetic, defensive, stressed, engaged
- **Intensity**: 0-1 confidence score per emotion
- **Timeline**: Emotion changes throughout conversation with timestamps

### Vocal Metrics
| Metric | What It Reveals | Example Values |
|--------|-----------------|----------------|
| **Pitch (Hz)** | Stress, emotion intensity | Calm: 100-150 Hz, Stressed: 200+ Hz |
| **Pitch Variance** | Emotional stability | Low variance = controlled, High = stressed |
| **Speech Rate (WPM)** | Confidence, anxiety | Normal: 130-150, Fast: 160+, Slow: <120 |
| **Pause Frequency** | Hesitation, uncertainty | Long pauses = thinking/uncertain |
| **Volume Variance** | Emotional control | Steady = professional, Spiky = reactive |

### Emotional Shifts
- Track when employee's emotional state changes
- Identify triggers (e.g., customer said X → employee became defensive)
- Measure recovery time (how fast they regain composure)

### Use Cases for Training
1. **Authenticity Detection**: Does "I'm happy to help" sound genuine or forced?
2. **Stress Management**: Does employee maintain calm voice with angry customers?
3. **Confidence Tracking**: Hesitant speech when discussing products = knowledge gap
4. **Empathy Validation**: Transcript says empathetic words, but does tone convey warmth?
5. **De-escalation Effectiveness**: Does employee's tone actually calm the customer?

---

## Available Emotion Detection APIs (2025)

### 🏆 **Hume AI** (Recommended)
**Best for**: Comprehensive emotion detection with nuanced analysis

**Key Features**:
- Detects **48+ emotions** (not just positive/negative/neutral)
- Empathic Voice Interface (EVI) for real-time analysis
- Multimodal: Voice, facial expressions, text
- Octave 2: 40% faster (<200ms generation), 11 languages, voice conversion
- Timestamped emotion predictions with confidence scores

**Input**: Raw audio (WAV, MP3, WebM)
**Output**:
```json
{
  "emotions": [
    {"name": "anxiety", "score": 0.72, "timestamp": 5.2},
    {"name": "empathy", "score": 0.45, "timestamp": 12.8},
    {"name": "confidence", "score": 0.88, "timestamp": 25.1}
  ],
  "prosody": {
    "pitch_mean": 145.3,
    "pitch_std": 22.1,
    "speech_rate": 142
  }
}
```

**Pricing**: ~$0.05 per minute of audio
**Docs**: https://dev.hume.ai/intro
**Best for**: Detailed emotional insights, nuanced analysis, real-time processing

---

### 💰 **AssemblyAI** (Budget Option)
**Best for**: Basic sentiment + speaker diarization on a budget

**Key Features**:
- Sentiment analysis: Positive, Neutral, Negative
- Speaker diarization (separates speakers automatically)
- Sentence-level sentiment with confidence scores
- Fast transcription + sentiment in one API call

**Input**: Audio URL or file upload
**Output**:
```json
{
  "sentiment_analysis_results": [
    {"text": "I'd be happy to help you with that.", "sentiment": "POSITIVE", "confidence": 0.92},
    {"text": "Um, let me, uh, check on that.", "sentiment": "NEUTRAL", "confidence": 0.68}
  ]
}
```

**Pricing**: ~$0.01 per minute of audio
**Docs**: https://www.assemblyai.com/docs/
**Best for**: Cost-sensitive implementations, basic sentiment tracking

**Limitations**:
- ❌ No detailed emotion recognition (only positive/neutral/negative)
- ❌ No vocal metrics (pitch, volume, rate)
- ❌ Text-based sentiment (analyzes transcript, not tone)

---

### 🏢 **Azure Cognitive Services - Speech Emotion**
**Best for**: Enterprise customers already using Azure

**Key Features**:
- Basic emotion labels: Angry, Sad, Neutral, Happy
- Low latency, enterprise-grade SLA
- Integrates with existing Azure ecosystem

**Input**: PCM/WAV audio
**Output**:
```json
{
  "emotion": "neutral",
  "confidence": 0.78
}
```

**Pricing**: ~$0.001 per minute (cheapest option)
**Docs**: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/
**Best for**: Enterprise customers, basic emotion detection, lowest cost

**Limitations**:
- ❌ Only 4 emotion categories
- ❌ No emotion timeline (single label per audio)
- ❌ No vocal prosody metrics

---

## Implementation Approaches

### 🔧 **Option A: Post-Processing** (Recommended)
**Complexity**: Medium
**Timeline**: 2-3 weeks
**Pros**: No changes to recording system, works with existing sessions
**Cons**: Requires voice separation AI, adds processing time

**Architecture**:
```
Session Completes → User clicks "Analyze Emotion"
  ↓
Extract audio from Supabase Storage (video/audio file)
  ↓
AI Voice Separation (isolate user voice from AI voice)
  - Tool: Spleeter, Demucs, or AssemblyAI speaker diarization
  - Time: 30-60 seconds
  ↓
Send user-only audio to Emotion API (Hume AI)
  - Time: 10-20 seconds
  ↓
Parse results → Store in training_sessions.emotion_analysis_results (JSONB)
  ↓
Display: Emotion timeline, vocal metrics, emotional shifts
```

**Database Schema**:
```sql
ALTER TABLE training_sessions
ADD COLUMN IF NOT EXISTS emotion_analysis_results JSONB,
ADD COLUMN IF NOT EXISTS emotion_analysis_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS emotion_analysis_status TEXT
  CHECK (emotion_analysis_status IN ('pending', 'processing', 'completed', 'failed'));
```

**New API Route**: `/api/analyze-speech-emotion/route.ts`

**Caching Strategy** (same as assessment):
```typescript
// Check if already analyzed
if (!forceReAnalysis &&
    session.emotion_analysis_status === 'completed' &&
    session.emotion_analysis_results) {
  return { fromCache: true, results: session.emotion_analysis_results }
}
```

**Voice Separation Challenge**:
- Current mixed audio requires AI-based separation
- Accuracy depends on: audio quality, voice overlap, background noise
- **Recommendation**: Test with sample recordings first

---

### 🔧 **Option B: Separate Audio Tracks** (Clean Architecture)
**Complexity**: High
**Timeline**: 3-4 weeks
**Pros**: Clean separation, no post-processing, higher accuracy
**Cons**: Complex recording logic, more storage, browser compatibility testing

**Architecture Changes**:
```typescript
// VideoRecordingService.ts - Record TWO separate tracks

Track 1: User microphone only
  → Store as: {sessionId}-user-audio.webm
  → Database: training_sessions.user_audio_url

Track 2: ElevenLabs agent audio only
  → Store as: {sessionId}-agent-audio.webm
  → Database: training_sessions.agent_audio_url

Track 3: Mixed audio for playback (existing)
  → Store as: {sessionId}-video.webm
  → Database: training_sessions.video_recording_url
```

**Database Schema**:
```sql
ALTER TABLE training_sessions
ADD COLUMN IF NOT EXISTS user_audio_url TEXT,
ADD COLUMN IF NOT EXISTS agent_audio_url TEXT;
```

**Browser Compatibility**:
- Chrome: Full support ✅
- Firefox: Full support ✅
- Safari 14.1+: Full support ✅
- iOS Safari: Requires separate permission requests ⚠️

---

## Integration Points

### 1. New API Route
**File**: `/api/analyze-speech-emotion/route.ts`

**Responsibilities**:
1. Fetch video/audio file from Supabase Storage
2. Extract audio (if video format)
3. Separate user voice from AI voice (Option A only)
4. Call emotion detection API (Hume AI recommended)
5. Parse emotion results and calculate metrics
6. Store in `training_sessions.emotion_analysis_results`

**Example Response**:
```typescript
interface EmotionAnalysisResults {
  overall_tone: 'positive' | 'neutral' | 'negative' | 'stressed'
  confidence_score: number  // 0-1
  emotional_timeline: Array<{
    timestamp: number  // seconds into conversation
    emotion: string   // 'calm', 'anxious', 'confident', 'frustrated'
    intensity: number  // 0-1
  }>
  vocal_metrics: {
    avg_pitch_hz: number
    pitch_variance: number  // indicator of stress
    speech_rate_wpm: number
    pause_frequency: number  // long pauses = hesitation?
    volume_variance: number
  }
  emotional_shifts: Array<{
    timestamp: number
    from_emotion: string
    to_emotion: string
    trigger?: string  // optional: what customer said
  }>
}
```

---

### 2. Session Details Page Updates
**File**: `/app/employee/sessions/[sessionId]/page.tsx`

**New UI Components**:

#### **Emotion Analysis Button**
```tsx
<button onClick={() => handleAnalyzeEmotion()} disabled={isAnalyzing}>
  {isAnalyzing ? '⏳ Analyzing...' : '🎭 Analyze Speech Emotion'}
</button>
```

#### **Emotion Timeline Visualization**
```tsx
<EmotionTimeline
  timeline={emotionAnalysis.emotional_timeline}
  duration={session.session_duration_seconds}
/>
```
- X-axis: Time (seconds)
- Y-axis: Emotion intensity (0-1)
- Color-coded emotions (calm = green, anxious = orange, stressed = red)
- Hover to see exact emotion + timestamp

#### **Vocal Metrics Card**
```tsx
<VocalMetricsCard
  avgPitch={emotionAnalysis.vocal_metrics.avg_pitch_hz}
  speechRate={emotionAnalysis.vocal_metrics.speech_rate_wpm}
  stressIndicators={emotionAnalysis.vocal_metrics.pitch_variance}
/>
```

**Display**:
| Metric | Value | Assessment |
|--------|-------|------------|
| Average Pitch | 145 Hz | ✅ Normal range |
| Speech Rate | 142 WPM | ✅ Confident pace |
| Pitch Variance | 0.18 | ✅ Emotionally controlled |
| Pause Frequency | 2.1/min | ⚠️ Some hesitation |

#### **Emotional Shifts Section**
```tsx
<EmotionalShiftsSection
  shifts={emotionAnalysis.emotional_shifts}
  transcript={session.conversation_transcript}
/>
```

**Example Display**:
```
⏱️ 0:12 - Calm → Anxious (Customer: "This is unacceptable!")
⏱️ 0:45 - Anxious → Confident (Employee regained composure)
⏱️ 2:10 - Confident → Empathetic (Customer explained frustration)
```

---

### 3. Enhanced GPT-4 Assessment Integration
**File**: `/api/assess-service-practice-session/route.ts`

**Combine Text + Emotion Data**:
```typescript
const prompt = `
... existing prompt ...

ADDITIONAL CONTEXT - SPEECH EMOTION ANALYSIS:
The employee's vocal tone analysis revealed:
- Overall Emotional State: ${emotionResults.overall_tone}
- Confidence Score: ${emotionResults.confidence_score}
- Stress Indicators: ${emotionResults.vocal_metrics.pitch_variance > 0.3 ? 'HIGH' : 'LOW'}
- Speech Rate: ${emotionResults.vocal_metrics.speech_rate_wpm} WPM
  (Normal: 130-150 WPM, Fast: 160+ indicates anxiety, Slow: <120 indicates hesitation)
- Emotional Shifts: ${emotionResults.emotional_shifts.length} detected
- Key Moments: ${emotionResults.emotional_shifts.map(s =>
    `${s.timestamp}s: ${s.from_emotion} → ${s.to_emotion}`).join(', ')}

Use this vocal tone data to supplement your assessment of:
- Empathy: Did their voice convey genuine warmth, or just words?
- Professionalism: Was tone calm and controlled throughout?
- De-escalation: Did pitch/rate indicate effective stress management?
- Confidence: Hesitations, "um"s, pitch variance suggest knowledge gaps?
- Emotional Authenticity: Does vocal tone match the sentiment of their words?
`
```

**New Metric**: `emotional_authenticity` (0-100)
- Cross-reference transcript text sentiment vs. vocal emotion
- Detect incongruence examples:
  - ❌ Saying "I'm happy to help" with stressed/frustrated tone
  - ❌ Saying "I understand your frustration" with monotone/dismissive voice
  - ✅ Empathetic words + warm, calm vocal tone

---

## UI Component Specifications

### EmotionTimeline.tsx
```typescript
interface EmotionTimelineProps {
  timeline: Array<{
    timestamp: number
    emotion: string
    intensity: number
  }>
  duration: number
}

// Visual: Line graph with color-coded emotions
// X-axis: Time (0s → session duration)
// Y-axis: Intensity (0-1)
// Colors: calm=green, confident=blue, anxious=orange, stressed=red, empathetic=purple
// Interactive: Hover to see exact emotion + timestamp
```

### VocalMetricsCard.tsx
```typescript
interface VocalMetricsCardProps {
  avgPitch: number
  speechRate: number
  pitchVariance: number
  pauseFrequency: number
  volumeVariance: number
}

// Visual: Card with progress bars + assessments
// Green checkmark = good, Yellow warning = moderate, Red X = needs improvement
// Tooltips explain what each metric means
```

### EmotionalShiftsSection.tsx
```typescript
interface EmotionalShiftsSectionProps {
  shifts: Array<{
    timestamp: number
    from_emotion: string
    to_emotion: string
    trigger?: string
  }>
  transcript: ConversationMessage[]
}

// Visual: Timeline with arrows showing emotion changes
// Click on shift → shows transcript excerpt around that moment
// Highlight trigger phrase from customer if available
```

---

## Cost Analysis

### Per-Session Costs (5-minute average session)

| Component | Provider | Cost |
|-----------|----------|------|
| Emotion Detection | Hume AI | $0.05 |
| Emotion Detection | AssemblyAI | $0.01 |
| Emotion Detection | Azure | $0.005 |
| Voice Separation (if needed) | Spleeter (self-hosted) | $0.00 |
| GPT-4 Assessment (existing) | OpenAI | $0.03 |
| **Total (Hume AI)** | | **$0.08** |
| **Total (AssemblyAI)** | | **$0.04** |
| **Total (Azure)** | | **$0.035** |

### Storage Costs (Supabase)
- Existing: 1 video file (~50 MB per 5-min session)
- Option B: +2 audio files (~5 MB each = +10 MB)
- **Storage increase**: 20% (if using Option B)

### Scaling Estimates
| Sessions/Month | Cost (Hume AI) | Cost (AssemblyAI) | Cost (Azure) |
|----------------|----------------|-------------------|--------------|
| 100 | $8 | $4 | $3.50 |
| 500 | $40 | $20 | $17.50 |
| 1,000 | $80 | $40 | $35 |
| 5,000 | $400 | $200 | $175 |

---

## Technical Considerations

### Processing Time Breakdown
1. **Audio Extraction**: 5-10 seconds (from video file)
2. **Voice Separation**: 30-60 seconds (if Option A)
3. **Emotion API Call**: 10-20 seconds
4. **Database Storage**: 1-2 seconds
5. **Total**: 45-90 seconds per session

**UX Optimization**:
- Run asynchronously (don't block user)
- Show progress indicator: "Extracting audio... Separating voices... Analyzing emotions..."
- Cache results forever (no need to re-analyze)
- Allow "Force Re-analyze" option if needed

### Browser Compatibility (for Option B)
| Browser | Web Audio API | MediaRecorder | Separate Tracks |
|---------|---------------|---------------|-----------------|
| Chrome | ✅ Full | ✅ Full | ✅ Full |
| Firefox | ✅ Full | ✅ Full | ✅ Full |
| Safari 14.1+ | ✅ Full | ✅ Full | ✅ Full |
| iOS Safari | ✅ Full | ✅ Full | ⚠️ Requires permission |
| Edge | ✅ Full | ✅ Full | ✅ Full |

### Voice Separation Accuracy (for Option A)
**Factors Affecting Accuracy**:
- ✅ High audio quality (48kHz, 256kbps+)
- ❌ Voice overlap (user and AI speak simultaneously)
- ❌ Background noise
- ❌ Low bitrate recordings (<128kbps)

**Tools for Voice Separation**:
1. **Spleeter** (Deezer) - Open source, good accuracy, CPU-intensive
2. **Demucs** (Meta) - State-of-the-art, better than Spleeter, slower
3. **AssemblyAI Speaker Diarization** - Built into API, automatic

**Recommendation**: Test with 5-10 sample recordings before committing to Option A

---

## Implementation Checklist

### Phase 1: MVP - Basic Emotion Detection (Option A)
**Timeline**: 2-3 weeks

- [ ] **Database Migration**
  - [ ] Add `emotion_analysis_results` JSONB column
  - [ ] Add `emotion_analysis_completed_at` timestamp
  - [ ] Add `emotion_analysis_status` enum
  - [ ] Create index for efficient queries

- [ ] **API Development**
  - [ ] Create `/api/analyze-speech-emotion/route.ts`
  - [ ] Implement audio extraction from Supabase Storage
  - [ ] Integrate with Hume AI API (or chosen provider)
  - [ ] Parse and structure emotion results
  - [ ] Implement caching logic (check if already analyzed)
  - [ ] Error handling (API failures, missing audio, etc.)

- [ ] **UI Components** (Basic)
  - [ ] Add "Analyze Emotion" button to session details page
  - [ ] Show loading state during analysis
  - [ ] Display overall emotional tone (positive/neutral/negative/stressed)
  - [ ] Show confidence score

- [ ] **Testing**
  - [ ] Test with 5-10 sample sessions
  - [ ] Verify voice separation accuracy (if Option A)
  - [ ] Check processing time (<2 minutes)
  - [ ] Test error scenarios (missing audio, API failures)

### Phase 2: Advanced UI Components
**Timeline**: 1-2 weeks

- [ ] **Emotion Timeline**
  - [ ] Create `EmotionTimeline.tsx` component
  - [ ] Line graph with color-coded emotions
  - [ ] Interactive hover for exact timestamps
  - [ ] Sync with video player (click timeline → jump to moment)

- [ ] **Vocal Metrics Card**
  - [ ] Create `VocalMetricsCard.tsx` component
  - [ ] Display pitch, speech rate, variance metrics
  - [ ] Add assessments (green checkmark, yellow warning, red X)
  - [ ] Tooltips explaining each metric

- [ ] **Emotional Shifts Section**
  - [ ] Create `EmotionalShiftsSection.tsx` component
  - [ ] Timeline view of emotion changes
  - [ ] Link to transcript excerpts around shifts
  - [ ] Highlight customer trigger phrases

### Phase 3: Enhanced GPT-4 Assessment Integration
**Timeline**: 1 week

- [ ] **Assessment API Updates**
  - [ ] Modify GPT-4 prompt to include emotion context
  - [ ] Add `emotional_authenticity` metric
  - [ ] Cross-reference transcript sentiment vs. vocal tone
  - [ ] Update scoring logic to consider emotional data

- [ ] **Manager Dashboard**
  - [ ] Display emotion metrics in session history
  - [ ] Add filters: "Show only stressed sessions"
  - [ ] Aggregate emotion stats across team

### Phase 4 (Optional): Separate Audio Tracks
**Timeline**: 2-3 weeks

- [ ] **Recording Service Overhaul**
  - [ ] Modify `VideoRecordingService.ts` to record dual tracks
  - [ ] Test across all browsers (Chrome, Firefox, Safari, iOS)
  - [ ] Handle permission requests properly
  - [ ] Backward compatibility with existing recordings

- [ ] **Storage Updates**
  - [ ] Create new storage paths for user/agent audio
  - [ ] Update upload logic for separate files
  - [ ] Database schema: `user_audio_url`, `agent_audio_url`

- [ ] **Migration Strategy**
  - [ ] Keep Option A for existing sessions
  - [ ] Use Option B for new sessions going forward
  - [ ] Allow re-analysis with better separation

---

## Decision Matrix

### When to Choose Hume AI
✅ You want detailed emotional insights (48+ emotions)
✅ You need real-time emotion detection
✅ Budget allows ~$0.05 per session
✅ Use case: Training quality assessment, coaching feedback

### When to Choose AssemblyAI
✅ Budget-conscious implementation
✅ Basic sentiment (positive/neutral/negative) is sufficient
✅ Already using AssemblyAI for transcription
✅ Use case: Large-scale monitoring, basic sentiment trends

### When to Choose Azure
✅ Enterprise customer already using Azure ecosystem
✅ Need lowest cost option (~$0.001 per session)
✅ Basic emotion labels (angry/sad/neutral/happy) sufficient
✅ Use case: High-volume basic emotion tracking

### When to Choose Option A (Post-Processing)
✅ Want to analyze existing sessions
✅ Don't want to change recording architecture
✅ Can tolerate 45-90s processing time
✅ Willing to test voice separation accuracy

### When to Choose Option B (Separate Tracks)
✅ Need highest accuracy user audio
✅ Want instant emotion analysis (no post-processing)
✅ Can invest time in architecture changes
✅ Have resources to test across all platforms

---

## Risks & Mitigations

### Risk 1: Voice Separation Accuracy (Option A)
**Risk**: AI voice separation fails with overlapping speech
**Mitigation**:
- Test with 10+ sample recordings before full implementation
- Use AssemblyAI speaker diarization (automatic)
- If accuracy <80%, pivot to Option B

### Risk 2: Processing Time Too Long
**Risk**: Users frustrated waiting 90+ seconds for results
**Mitigation**:
- Run asynchronously (don't block user)
- Cache results forever
- Show clear progress indicators
- Consider pre-processing top sessions overnight

### Risk 3: Cost Escalation
**Risk**: Emotion analysis costs exceed budget at scale
**Mitigation**:
- Start with Hume AI for quality assessment
- Monitor cost per session
- If costs too high, pivot to AssemblyAI or Azure
- Allow managers to manually select sessions to analyze (not automatic)

### Risk 4: False Positives/Negatives
**Risk**: Emotion detection misinterprets tone (e.g., sarcasm detected as anger)
**Mitigation**:
- Display confidence scores always
- Allow manual override: "Mark as incorrect"
- Use emotion data as **supplement** to GPT-4 assessment, not replacement
- Train managers: "Emotion AI is a guide, not gospel"

---

## Next Steps

### Immediate Actions
1. **Decide on API Provider**: Hume AI (recommended) vs. AssemblyAI vs. Azure
2. **Choose Implementation Approach**: Option A (post-processing) vs. Option B (separate tracks)
3. **Test Voice Separation**: If Option A, test Spleeter/Demucs on 5 sample recordings
4. **Get API Keys**: Sign up for chosen emotion detection service
5. **Budget Approval**: Get sign-off on ~$0.05-0.08 per session cost

### Phase 1 Deliverables (MVP)
- ✅ Emotion analysis API working
- ✅ Basic UI showing overall emotional tone
- ✅ Database storage of results
- ✅ Caching implemented
- ✅ Tested on 10+ sample sessions

### Phase 2 Deliverables (Full Feature)
- ✅ Emotion timeline visualization
- ✅ Vocal metrics card
- ✅ Emotional shifts section
- ✅ Integration with GPT-4 assessment
- ✅ Manager dashboard updates

---

## Related Documentation
- **SERVICE_PRACTICE_ANALYSIS_2025-11-09.md** - Current text-based assessment system
- **VIDEO_RECORDING_SYSTEM_DOCUMENTATION.md** - Audio recording architecture
- **API_REFERENCE.md** - Existing API endpoints
- **DATABASE_REFERENCE.md** - Schema for training_sessions table

---

## Questions for Future Discussion

1. Should emotion analysis be **automatic** (runs on every session) or **manual** (manager clicks "Analyze")?
2. Should we analyze **Theory Q&A sessions** as well, or just Service Practice?
3. Do we want **real-time emotion feedback** during sessions (not just post-analysis)?
4. Should employees see their own emotion metrics, or only managers?
5. Integration with existing **mastery tracking system** (emotion as learning indicator)?

---

## References

- **Hume AI Documentation**: https://dev.hume.ai/intro
- **AssemblyAI Sentiment Analysis**: https://www.assemblyai.com/docs/speech-to-text/sentiment-analysis
- **Azure Speech Emotion Recognition**: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech
- **Spleeter (Voice Separation)**: https://github.com/deezer/spleeter
- **Demucs (Voice Separation)**: https://github.com/facebookresearch/demucs
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

---

**Document Version**: 1.0
**Last Updated**: 2025-11-18
**Author**: Research findings from Claude Code session
**Status**: 📋 Ready for implementation planning
