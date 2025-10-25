# Service Practice Improvements - October 25, 2025

## Critical Bug Fixes ✅

### 1. Custom First Message Not Passed to ElevenLabs (FIXED)
**Issue**: Custom first messages stored in database were not being sent to ElevenLabs AI.

**Root Cause**: The training page component was not including `first_message` in the `scenarioContext` object passed to `ElevenLabsAvatarSession`.

**Fix**: Added `first_message: currentScenario.first_message` to scenarioContext in training page.

**Files Modified**:
- `src/app/employee/training/[assignmentId]/page.tsx` (line 1461)

**Example**:
```typescript
scenarioContext={{
  title: currentScenario.title,
  description: currentScenario.description,
  type: currentScenario.scenario_type,
  client_behavior: currentScenario.client_behavior,
  expected_response: currentScenario.expected_response,
  customer_emotion_level: currentScenario.customer_emotion_level,
  first_message: currentScenario.first_message,  // ✅ ADDED
  milestones: currentScenario.milestones
}}
```

**Impact**: Now AI customers immediately start conversations with custom opening lines like "AAA!!! Я умираю!" instead of generic greetings.

---

### 2. Scenario-Specific Behavior Missing from Emotion Prompts (CRITICAL FIX)
**Issue**: AI was ignoring detailed `client_behavior` instructions (e.g., "you MUST get the receipt and can't leave without it") and acting generically.

**Root Cause**: The emotion-based system prompt (used for ALL scenarios with `customer_emotion_level` set) was missing the `client_behavior` field entirely. Only the fallback generic prompt included it.

**Affected Scenarios**:
- ✅ ALL scenarios with `customer_emotion_level` set (normal, cold, in_a_hurry, angry, extremely_angry)
- ❌ Only scenarios with NO emotion level were working correctly

**Fix**: Added `client_behavior` insertion in emotion-based prompt between scenario title and emotion personality.

**Files Modified**:
- `src/lib/elevenlabs-conversation.ts` (line 264)

**Before**:
```typescript
# Personality
You are ${customerName}, a customer at a ${establishmentType}.

Situation: ${dynamicVariables?.scenario_title || 'You are visiting this establishment seeking service'}

${emotionDefinition.personality}  // Only generic emotion behavior
```

**After**:
```typescript
# Personality
You are ${customerName}, a customer at a ${establishmentType}.

Situation: ${dynamicVariables?.scenario_title || 'You are visiting this establishment seeking service'}

${dynamicVariables?.client_behavior ? '\n' + dynamicVariables.client_behavior + '\n' : ''}  // ✅ ADDED

${emotionDefinition.personality}
```

**Impact**:
- AI now follows scenario-specific behavioral requirements (e.g., "won't leave without receipt")
- Emotion level still applies (normal = polite, angry = upset) BUT with custom scenario context
- Fixes all Service Practice scenarios that weren't working as designed

---

## UI Improvements ✨

### 3. Conversation Transcript Redesign
**Issue**: Session transcript page showed plain text with no visual distinction between speakers.

**Old Design**:
- Plain text alternating left/right by index (even/odd)
- No chat bubbles
- No color distinction
- Only latest message was black, others gray

**New Design**:
- Modern chat bubble interface (WhatsApp/iMessage style)
- Role-based alignment:
  - AI Customer (`role: 'assistant'`) → Left side, gray bubble
  - Employee (`role: 'user'`) → Right side, green bubble
- Rounded corners with proper padding
- Clean design without speaker labels (as requested)

**Files Modified**:
- `src/app/employee/sessions/[sessionId]/page.tsx` (lines 786-809)

**Code Changes**:
```typescript
// Before: Plain text
<p className={`text-sm leading-relaxed ${isLatest ? 'text-gray-900' : 'text-gray-500'}`}>
  {message.content}
</p>

// After: Chat bubbles
<div className={`max-w-[75%] rounded-lg px-4 py-3 ${
  isAssistant
    ? 'bg-gray-100 text-gray-900'  // AI customer: gray bubble on left
    : 'bg-green-100 text-gray-900'  // Employee: green bubble on right
}`}>
  <p className="text-sm leading-relaxed">
    {message.content}
  </p>
</div>
```

**Impact**: Much more readable conversation history with clear visual distinction between AI and trainee.

---

## Technical Notes

### Data Flow for Custom First Message
1. **Database** → `scenarios.first_message` column (TEXT, nullable)
2. **Training Page** → `scenarioContext.first_message` passed to component
3. **Component** → `dynamicVariables.first_message` passed to ElevenLabs
4. **Conversation Service** → `getScenarioSpecificGreeting()` uses custom message
5. **ElevenLabs API** → `overrides.agent.firstMessage` with custom greeting

### Data Flow for Client Behavior
1. **Database** → `scenarios.client_behavior` column (TEXT)
2. **Training Page** → `scenarioContext.client_behavior` passed to component
3. **Component** → `dynamicVariables.client_behavior` passed to ElevenLabs
4. **Conversation Service** → Inserted into system prompt after scenario title
5. **ElevenLabs AI** → Follows both emotion level AND scenario-specific behavior

---

## Testing Recommendations

### Test Scenario 1: Custom First Message
- **Scenario ID**: `6e98b138-2cf2-4d70-ad0e-f71332bedc06`
- **First Message**: "AAA!!! Я умираю!"
- **Expected**: AI starts with this dramatic opening instead of "Здравствуйте"

### Test Scenario 2: Receipt Request Persistence
- **Scenario ID**: `4f1497ee-e1d5-4df8-8b1e-0cb1f55d70fa`
- **Behavior**: Customer needs receipt for accounting, can't leave without it
- **Expected**: AI insists on getting receipt, doesn't accept "no" and suggest ordering coffee
- **Before Fix**: AI gave up immediately and suggested ordering something
- **After Fix**: AI follows scenario instructions persistently

### Test Scenario 3: Transcript Readability
- **URL**: `localhost:3000/employee/sessions/[any-session-id]`
- **Expected**: Chat bubbles with gray (AI) on left, green (you) on right
- **Before**: Plain alternating text
- **After**: Modern chat interface

---

## Known Limitations

1. **Custom First Message**: Only works for Service Practice scenarios (Theory Q&A uses standard examiner greeting)
2. **Language**: Custom first message is input in one language, AI naturally translates to session language
3. **Transcript Bubbles**: Currently no speaker labels or icons (by design choice)

---

## Future Improvements (Potential)

1. Add timestamp labels to transcript bubbles (e.g., "2 minutes ago")
2. Add "..." typing indicator between messages in transcript
3. Support for custom first message in multiple languages (stored as JSON)
4. Add speaker labels toggle (show/hide names/icons)
5. Add export transcript button (PDF, TXT, JSON)

---

## Credits

Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
