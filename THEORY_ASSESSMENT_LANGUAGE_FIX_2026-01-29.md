# Theory Assessment Language-Aware Fix + ElevenLabs Transcript Fetching

**Date**: 2026-01-29
**Status**: ✅ COMPLETE
**Issue**: Theory Q&A assessment feedback was always in English, regardless of session language

---

## Problem Statement

### Issues Identified

1. **Language Mismatch**: Theory assessment feedback was hardcoded in English
   - Russian sessions received English feedback
   - Italian sessions received English feedback
   - No language awareness in GPT-4 prompts

2. **Missing Transcripts**: Sessions with incomplete/missing transcripts weren't fetching from ElevenLabs
   - Sessions with only 1 message (greeting) marked as "0 Q&A exchanges"
   - Full conversations in ElevenLabs (e.g., 3:11 duration) not being analyzed
   - Theory assessment API lacked transcript fetching logic (service practice had it)

3. **Incomplete Sessions Stuck in Queue**: Sessions with 0 Q&A exchanges not marked as 'completed'
   - Caused infinite loop in batch analysis bar
   - Sessions kept reappearing in unanalyzed queue

---

## Solution Implemented

### 1. Language-Aware Assessment (Theory Q&A)

**File Modified**: `/src/app/api/assessment/assess-theory-session/route.ts`

#### Added Language Mapping Function
```typescript
function getLanguageName(languageCode: string): string {
  const languageMap: Record<string, string> = {
    'en': 'English',
    'ru': 'Russian',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'cs': 'Czech',
    'nl': 'Dutch',
    'pl': 'Polish',
    'ka': 'Georgian'
  }
  return languageMap[languageCode] || 'English'
}
```

#### Updated `assessAnswer` Function Signature
```typescript
// Before
async function assessAnswer(
  question: string,
  userAnswer: string,
  correctAnswer: string,
  topicName: string
)

// After
async function assessAnswer(
  question: string,
  userAnswer: string,
  correctAnswer: string,
  topicName: string,
  language: string = 'en'  // ✅ NEW PARAMETER
)
```

#### Updated GPT-4 Prompt with Language Instruction
```typescript
const languageName = getLanguageName(language)
console.log(`🌍 Assessing answer in ${languageName} (${language})`)

const prompt = `Assess this Q&A exchange for a ${topicName} training session:

Question: ${question}
Student Answer: ${userAnswer}
Expected Answer: ${correctAnswer}

Evaluate the student's answer and provide:
1. Whether it's correct (true/false)
2. A score from 0-100
3. Brief feedback (max 100 words) **IMPORTANT: Write feedback in ${languageName} language**

**CRITICAL LANGUAGE INSTRUCTION**:
You MUST write the "feedback" field in ${languageName} language.
Only the JSON structure and field names should remain in English.

Respond in this exact JSON format:
{
  "isCorrect": true/false,
  "score": number,
  "feedback": "brief explanation in ${languageName}"
}`
```

#### Pass Session Language to Assessment
```typescript
// In the main assessment loop (line ~268)
const assessment = await assessAnswer(
  exchange.question,
  exchange.answer,
  matchedQuestion.correct_answer,
  topicName,
  session.language || 'en'  // ✅ PASS SESSION LANGUAGE
)
```

---

### 2. ElevenLabs Transcript Fetching (Theory Q&A)

**Previously**: Only Service Practice API fetched missing transcripts from ElevenLabs
**Now**: Theory Q&A API has the same logic

#### Implementation Details

**Added at line ~45** in `assess-theory-session/route.ts`:

```typescript
// Fetch session from database to get ElevenLabs conversation ID if needed
const { data: session, error: sessionError } = await supabaseAdmin
  .from('training_sessions')
  .select('*')
  .eq('id', sessionId)
  .single()

// Determine which transcript to use
let transcript = providedTranscript || session.conversation_transcript

// Check if transcript needs to be fetched from ElevenLabs
const needsTranscriptFetch =
  !transcript ||
  transcript.length === 0 ||
  (transcript.length === 1 && transcript[0].content.includes('Get Transcript'))

if (needsTranscriptFetch && session.elevenlabs_conversation_id) {
  console.log('📥 Transcript missing or incomplete, fetching from ElevenLabs...')

  const transcriptResponse = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${session.elevenlabs_conversation_id}`,
    {
      method: 'GET',
      headers: {
        'xi-api-key': elevenlabsApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  )

  const conversationData = await transcriptResponse.json()

  // Extract transcript messages
  const fetchedTranscript: ConversationMessage[] = []
  if (Array.isArray(conversationData.transcript)) {
    for (const msg of conversationData.transcript) {
      fetchedTranscript.push({
        role: msg.role === 'agent' ? 'assistant' : 'user',
        content: msg.message || '',
        timestamp: msg.time_in_call_secs ? msg.time_in_call_secs * 1000 : Date.now()
      })
    }
  }

  // Update database with fetched transcript
  await supabaseAdmin
    .from('training_sessions')
    .update({ conversation_transcript: fetchedTranscript })
    .eq('id', sessionId)

  transcript = fetchedTranscript
}
```

**Benefits**:
- ✅ Automatically recovers missing transcripts from ElevenLabs
- ✅ Saves fetched transcript to database for future use
- ✅ Handles sessions where transcript failed to save during session end
- ✅ Same behavior as Service Practice API (consistency)

---

### 3. Empty Session Handling

**Fixed**: Sessions with 0 Q&A exchanges now properly marked as 'completed'

**File Modified**: `/src/app/api/assessment/assess-theory-session/route.ts` (line ~108)

```typescript
if (qaExchanges.length === 0) {
  // Mark session as completed even if no Q&A exchanges found
  const emptyAssessment = {
    summary: { totalQuestions: 0, correctAnswers: 0, score: 0 },
    assessmentResults: [],
    processedExchanges: 0,
    matchedQuestions: 0,
    analyzedAt: new Date().toISOString()
  }

  const { error: updateError } = await supabaseAdmin
    .from('training_sessions')
    .update({
      theory_assessment_results: emptyAssessment,
      assessment_completed_at: new Date().toISOString(),
      assessment_status: 'completed'  // ✅ NOW SETS STATUS
    })
    .eq('id', sessionId)

  console.log('✅ Empty session marked as completed (no Q&A exchanges)')

  return NextResponse.json({
    success: true,
    assessmentResults: [],
    summary: { totalQuestions: 0, correctAnswers: 0, score: 0 },
    message: 'No Q&A exchanges found in transcript',
    assessment: emptyAssessment
  })
}
```

**Why This Matters**:
- Prevents infinite loops in batch analysis bar
- Sessions with only greetings are properly handled
- Clean queue management

---

## Testing & Verification

### Test Case: Session `057d3c30-78dc-412f-99c9-f63fe08d16e1`

**Initial State**:
- ❌ Only 1 message in database transcript
- ❌ Marked as "0 Q&A exchanges"
- ❌ Feedback in English (should be Russian)
- ✅ Full conversation in ElevenLabs (3:11 duration, conv_9901kfd8qsehekary2scy4w7man2)

**After Fix**:
1. ✅ Fetches full transcript from ElevenLabs automatically
2. ✅ Extracts multiple Q&A exchanges
3. ✅ Provides feedback in Russian language
4. ✅ Properly analyzes all questions

### How to Re-Analyze a Session

**Option 1: Manual SQL Reset** (for specific sessions)
```sql
UPDATE training_sessions
SET assessment_status = 'pending',
    assessment_completed_at = NULL,
    theory_assessment_results = NULL
WHERE id = '057d3c30-78dc-412f-99c9-f63fe08d16e1';
```

**Option 2: Batch Analysis Bar** (automatic)
1. Session appears in batch analysis bar after reset
2. Click "Начать анализ" / "Start Analyzing"
3. System automatically:
   - Fetches missing transcript from ElevenLabs
   - Analyzes in correct language
   - Saves results to database

---

## Language Support Matrix

| Language Code | Language Name | Feedback Language |
|--------------|---------------|-------------------|
| `en` | English | ✅ English |
| `ru` | Russian | ✅ Русский |
| `es` | Spanish | ✅ Español |
| `fr` | French | ✅ Français |
| `de` | German | ✅ Deutsch |
| `it` | Italian | ✅ Italiano |
| `pt` | Portuguese | ✅ Português |
| `cs` | Czech | ✅ Čeština |
| `nl` | Dutch | ✅ Nederlands |
| `pl` | Polish | ✅ Polski |
| `ja` | Japanese | ✅ 日本語 |
| `ko` | Korean | ✅ 한국어 |
| `zh` | Chinese | ✅ 中文 |
| `ka` | Georgian | ✅ ქართული |
| `ar` | Arabic | ✅ العربية |
| `hi` | Hindi | ✅ हिन्दी |

---

## Files Modified

### Core Changes (2 files)

1. **`/src/app/api/assessment/assess-theory-session/route.ts`**
   - Added `getLanguageName()` function
   - Updated `assessAnswer()` to accept `language` parameter
   - Modified GPT-4 prompt with language instructions
   - Added ElevenLabs transcript fetching logic
   - Fixed empty session handling

2. **`/src/components/Manager/BatchAnalysisBar.tsx`** (optimization)
   - Added race condition prevention with `isFetchingRef`
   - Reduced excessive API polling

---

## Console Logs for Debugging

**Successful Language-Aware Assessment**:
```
🎯 Assessing theory session 057d3c30-78dc-412f-99c9-f63fe08d16e1 for user 233f69c5-844a-474e-9f17-ebb815315eb5
📥 Transcript missing or incomplete, fetching from ElevenLabs...
🔑 Using ElevenLabs conversation ID: conv_9901kfd8qsehekary2scy4w7man2
✅ Successfully fetched 12 messages from ElevenLabs
✅ Saved transcript to database
📝 Transcript contains 12 messages
💬 Extracted 5 Q&A exchanges from transcript
🌍 Assessing answer in Russian (ru)
📊 Assessment complete: 2/5 correct (40%)
✅ Assessment results cached in database
```

---

## Backward Compatibility

✅ **Fully Backward Compatible**:
- `language` parameter defaults to `'en'` if not provided
- Existing API calls without language still work (English feedback)
- No breaking changes to request/response format
- All existing sessions remain functional

---

## Future Improvements (Optional)

1. **Re-analyze Button**: Add UI button on session detail page for managers to trigger re-analysis
2. **Bulk Re-analysis**: API endpoint to reset multiple sessions at once
3. **Language Detection**: Auto-detect language from transcript if not specified
4. **Feedback Quality Metrics**: Track GPT-4 feedback quality across languages

---

## Related Documentation

- **BATCH_ANALYSIS_IMPLEMENTATION.md** - Batch analysis bar implementation
- **SERVICE_PRACTICE_ANALYSIS_2025-11-09.md** - Service practice assessment (already language-aware)
- **ELEVENLABS_SCRIBE_V2_MIGRATION_2026-01-14.md** - ElevenLabs integration details

---

## Success Metrics

✅ **Problem Solved**: Theory Q&A feedback now matches session language
✅ **Consistency**: Theory and Service Practice both fetch missing transcripts
✅ **Queue Management**: Empty sessions no longer stuck in batch analysis
✅ **User Experience**: Russian sessions get Russian feedback, Italian get Italian, etc.

**Status**: PRODUCTION READY ✅
