# Flipboard Prompt Fix (2025-12-05)

## Problem
Flipboard/Reception training sessions were incorrectly using the **Service Practice customer prompt** instead of the **employee/administrator prompt**. This caused the AI to act as a customer asking for service instead of a hotel staff member answering customer questions.

## Symptom
When starting a Flipboard session (e.g., Reception scenario), the AI would:
- Use prompt: `"# CRITICAL ROLE: CUSTOMER ONLY..."`
- Act as a customer wanting service
- Ask: `"Чем я могу вам помочь?"` (How can I help you?) - as if receiving service
- Try to place orders or ask for assistance

**Expected Behavior**: AI should act as hotel staff (e.g., "Mike from Reception") who helps customers by answering their questions.

## Root Cause

**File**: `src/hooks/useElevenLabsConversation.ts`
**Line**: 300 (before fix)

The training mode determination logic was incomplete:

```typescript
// BUGGY CODE
const trainingMode = scenarioContext?.type === 'theory' ? 'theory' : 'service_practice';
```

This code:
1. Checked if the scenario type is 'theory'
2. If not, **defaulted to 'service_practice'** for ALL other modes
3. Never checked for 'flipboard' mode

Since 'flipboard' was never checked, it always fell through to the default 'service_practice', causing flipboard sessions to use the customer prompt.

## Solution

**Single Line Fix** in `src/hooks/useElevenLabsConversation.ts` at line 300:

```typescript
// FIXED CODE
const trainingMode = scenarioContext?.type === 'theory' ? 'theory'
  : scenarioContext?.type === 'flipboard' ? 'flipboard'
  : 'service_practice';
```

Now the logic properly checks for all three modes in order:
1. Is it 'theory'? → Use theory mode (examiner)
2. Is it 'flipboard'? → Use flipboard mode (employee) ✅ **NEW**
3. Otherwise → Use service_practice mode (customer)

## Technical Flow

### Before Fix (Buggy)
1. User starts Flipboard session (Reception scenario with `scenario_type: 'flipboard'`)
2. Hook reads `scenarioContext.type` as `'flipboard'`
3. Line 300 checks: Is it `'theory'`? No → **Defaults to 'service_practice'** ❌
4. `dynamicVariables.training_mode` is set to `'service_practice'` (wrong!)
5. `elevenlabs-conversation.ts` receives `training_mode: 'service_practice'`
6. Executes Service Practice branch (lines 249-481) → Customer role prompt
7. AI acts as customer instead of employee

### After Fix (Correct)
1. User starts Flipboard session (Reception scenario with `scenario_type: 'flipboard'`)
2. Hook reads `scenarioContext.type` as `'flipboard'`
3. Line 300 checks: Is it `'theory'`? No → Is it `'flipboard'`? **Yes!** ✅
4. `dynamicVariables.training_mode` is set to `'flipboard'` (correct!)
5. `elevenlabs-conversation.ts` receives `training_mode: 'flipboard'`
6. Executes Flipboard branch (lines 204-248) → Employee role prompt
7. AI acts as hotel staff member

## Existing Flipboard Prompt (Already Well-Designed)

The flipboard prompt at **`src/lib/elevenlabs-conversation.ts` lines 204-248** was already correctly implemented but never executed due to this bug:

**Role**: `"You are ${employeeName}, a knowledgeable and professional ${employeeRole} at ${establishmentType}"`

**Key Characteristics**:
- AI acts as customer-facing employee (e.g., "Mike from Reception")
- Answers questions professionally using knowledge base
- Provides accurate information about the business
- Stays in employee role throughout the conversation
- Uses natural conversational language in the selected language

**Example Greeting**: "Hello! Welcome. How can I help you today?"

## Files Modified

1. **`src/hooks/useElevenLabsConversation.ts`**
   - Line 300-302: Added flipboard check to training mode determination
   - Changes: 1 line expanded to 3 lines with proper ternary chain

## Training Modes Supported

The system supports **4 training modes**:

| Mode | AI Role | Prompt Location | Use Case |
|------|---------|----------------|----------|
| **theory** | Examiner/Teacher | Lines 483-512 | Theory Q&A with factual questions |
| **service_practice** | Customer | Lines 249-481 | Service roleplay (employee serves AI customer) |
| **flipboard** | Employee/Staff | Lines 204-248 | Reception training (customer asks, AI employee answers) |
| **recommendations** | N/A (TTS) | Different system | Product recommendation training |

## Verification

### Console Logs (After Fix)
When starting a Flipboard session, you should see:
```
🎯 Starting session with dynamic variables: {training_mode: 'flipboard', ...}
📝 System prompt preview: You are Mike, a knowledgeable and professional employee...
// NOT: # CRITICAL ROLE: CUSTOMER ONLY
```

### AI Behavior (After Fix)
- ✅ Greets as hotel staff: "Hello! Welcome. How can I help you today?"
- ✅ Answers customer questions using knowledge base
- ✅ Acts professionally as administrator/employee
- ✅ Uses establishment name (e.g., "Hotel Mota") appropriately
- ❌ Does NOT ask customer-like questions
- ❌ Does NOT try to place orders or ask for service

## Impact

- **Scope**: Minimal - single conditional check added
- **Risk**: Very low - only affects training mode detection logic
- **Backwards Compatibility**: 100% - theory and service_practice modes unchanged
- **Performance**: No performance impact
- **Testing**: Manual verification by starting Flipboard session

## Testing Performed

1. Started Reception (Flipboard) scenario
2. Verified console logs show `training_mode: 'flipboard'`
3. Confirmed AI acts as hotel employee (Mike from Reception)
4. AI answered questions about Hotel Mota using knowledge base
5. AI maintained professional employee role throughout conversation

**Status**: ✅ **VERIFIED WORKING**

## Related Documentation

- **Flipboard Text Chat**: See `FLIPBOARD_TEXT_CHAT_IMPLEMENTATION.md` (different feature)
- **Knowledge Base**: See `KNOWLEDGE_BASE_FINAL_IMPLEMENTATION.md`
- **ElevenLabs Integration**: See `PROJECT_DOCUMENTATION.md`

## Historical Context

The flipboard prompt was originally designed correctly (well before this fix), but it was never being used because the training mode detection in the hook was incomplete. This bug likely existed since the initial flipboard implementation.

The fix simply enables the existing, well-designed flipboard prompt to actually execute when it should.

## Future Considerations

If adding new training modes in the future:
1. Add the mode to `ScenarioType` in `src/types/scenarios.ts`
2. Add the mode check to line 300 in `src/hooks/useElevenLabsConversation.ts`
3. Add the prompt template to `src/lib/elevenlabs-conversation.ts`
4. Add the greeting to `getScenarioSpecificGreeting()` if needed

## Status
✅ **PRODUCTION READY** (2025-12-05)
- Bug identified and fixed
- Tested and verified working
- Documentation complete
