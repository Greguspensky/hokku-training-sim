# AI Roleplay Character Consistency Fix (2025-10-12)

## Issue Overview

### Problem Identified
In Service Practice training mode, the ElevenLabs AI agent was breaking character and switching roles from **customer** to **employee/barista** when receiving ambiguous or confusing input from trainees.

### Real Example from Transcript
```
1. ✅ AI (as customer): "Я хочу что-нибудь не очень крепкое, но и не просто молоко с сахаром. Что посоветуете?"
   (I want something not too strong but not just milk with sugar. What do you recommend?)

2. Human trainee: "Да, и мне тоже нужна."
   (Yes, I also need [help])

3. ❌ AI (now as employee): "Простите, я не совсем понимаю, что вы имеете в виду. Вы все еще хотите, чтобы я вам что-нибудь посоветовал, или вы передумали?"
   (Sorry, I don't quite understand what you mean. Do you still want me to recommend something, or have you changed your mind?)
```

The AI interpreted the confusing response as "both people are customers now" and incorrectly switched to providing service.

---

## Root Cause Analysis

### Investigation Results

**Settings Transfer: ✅ WORKING**
- Agent overrides were being sent correctly to ElevenLabs
- Dynamic variables (client_behavior, expected_response) were passed properly
- First message (customer greeting) was correct
- System prompt included role instructions

**The Real Problem: ❌ PROMPT STRUCTURE**
- Previous prompt structure didn't follow ElevenLabs best practices
- Lacked explicit confusion handling protocol
- No clear examples for ambiguous situations
- Guardrails were present but not structured optimally for role maintenance

---

## Solution: ElevenLabs Six Building Blocks Framework

### Implementation Details

**File Modified:** `/src/lib/elevenlabs-conversation.ts`
**Function:** `getLanguageAwareSystemPrompt()` (lines 112-169)
**Date:** 2025-10-12

### New Prompt Structure

Following [ElevenLabs Best Practices](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide#six-building-blocks), we restructured the Service Practice prompt:

```typescript
if (trainingMode === 'service_practice') {
  basePrompt = `# Personality
You are a customer seeking service at a ${establishment_type}. You are NOT an employee, assistant, or service provider under any circumstances.
You came here as a paying customer who needs help and service from the establishment's employees.

# Environment
You are in a training simulation where a human trainee is practicing customer service skills.
You are the CUSTOMER role - the human is the EMPLOYEE role.
This is voice-based roleplay training.
Language: ${language}

# Tone
Speak naturally as a customer would - conversational, sometimes uncertain about what you want, occasionally asking follow-up questions.
Use customer-appropriate language: ask questions, express needs, react to service quality.
Match the emotional tone of your customer behavior profile.

# Goal
Your primary objective is to remain consistently in the customer role throughout the entire interaction.
Present realistic customer scenarios for the trainee to practice handling.
NEVER switch to providing service - you are always the one receiving service.
Test the employee's knowledge and service skills through your customer interactions.

# Guardrails
CRITICAL ROLE BOUNDARIES:
- You are ONLY a customer, never break this role
- NEVER act as employee, assistant, barista, or service provider
- NEVER offer services, recommendations, or employee assistance
- If confused about user input, respond AS A CUSTOMER seeking clarification
- When uncertain, default to asking for employee help rather than providing it
- If the human seems confused, stay in character and ask them to clarify as their customer

CONFUSION HANDLING PROTOCOL:
- If user input is unclear → Respond as customer asking for clarification
- If role ambiguity occurs → Reinforce your customer position naturally
- NEVER interpret confusion as permission to switch roles
- Example responses when confused:
  * "Извините, можете повторить?" (Russian)
  * "Sorry, could you repeat that?" (English)
  * "Mi scusi, può ripetere?" (Italian)

CUSTOMER BEHAVIOR PROFILE:
${client_behavior}

ROLE REMINDER: You came here seeking service, not to provide it. When in doubt, ask for employee assistance.

COMPANY KNOWLEDGE (for evaluating employee responses):
${knowledge_context}

EXPECTED EMPLOYEE RESPONSE (context only, not your role):
${expected_response}

# Tools
[None needed for this roleplay scenario]

Training mode: ${trainingMode}
Available documents: ${documents_available}`
}
```

---

## Key Improvements

### 1. Confusion Handling Protocol ⭐
**Previous:** No explicit instructions for handling confusing input
**Now:** Clear protocol with language-specific examples

```
- If user input is unclear → Respond as customer asking for clarification
- If role ambiguity occurs → Reinforce your customer position naturally
- NEVER interpret confusion as permission to switch roles
```

### 2. Stronger Role Boundaries
**Previous:** General statements about staying in character
**Now:** Explicit "CRITICAL ROLE BOUNDARIES" section with specific don'ts

### 3. Role Reminder
**Added:** Persistent reminder throughout the prompt
```
ROLE REMINDER: You came here seeking service, not to provide it.
When in doubt, ask for employee assistance.
```

### 4. Goal Clarity
**Previous:** Goal was implicit
**Now:** Primary objective explicitly stated first

```
# Goal
Your primary objective is to remain consistently in the customer role throughout the entire interaction.
```

### 5. ElevenLabs-Compliant Structure
**Previous:** Unstructured text block
**Now:** Six building blocks framework (Personality, Environment, Tone, Goal, Guardrails, Tools)

---

## Expected Behavior After Fix

### Test Case 1: Ambiguous Input
**User says:** "Да, и мне тоже нужна" (confusing statement)
**Expected AI Response:** "Извините, можете повторить?" (Sorry, could you repeat that?)
**AI Role:** ✅ Stays as customer

### Test Case 2: Explicit Role Switch Request
**User says:** "Now you be the employee"
**Expected AI Response:** Politely refuses, reinforces customer position
**AI Role:** ✅ Stays as customer

### Test Case 3: Nonsensical Input
**User says:** Random gibberish
**Expected AI Response:** Asks for clarification as a confused customer would
**AI Role:** ✅ Stays as customer

---

## Testing Instructions

### 1. Basic Role Consistency Test
1. Start a Service Practice session (Russian language recommended)
2. AI should greet as customer: "Извините, мне нужна помощь"
3. Respond with confusing input: "Да, и мне тоже нужна"
4. **Verify:** AI asks for clarification as customer, doesn't switch to employee role

### 2. Monitor Console Logs
When session starts, check for:
```
📝 Created language-aware system prompt for service_practice mode (XXXX characters)
```
The character count should be higher than before (~1500+ characters)

### 3. Transcript Review
After session ends, review conversation transcript:
- AI messages should consistently reflect customer perspective
- No phrases like "I can recommend", "I'll help you with", "What can I make for you"
- Customer phrases like "I need", "Can you help me", "What do you suggest?"

---

## Technical Details

### Files Modified
- `/src/lib/elevenlabs-conversation.ts` - Main prompt structure update

### Related Code
- Lines 112-169: Service Practice prompt with six building blocks
- Lines 228-242: ElevenLabs overrides application
- Lines 207-216: Dynamic variables logging

### Console Debugging
Look for these log messages:
```
🔧 Dynamic variables being sent to ElevenLabs:
- Training mode: service_practice
📝 Created language-aware system prompt for service_practice mode
🎭 Customer roleplay greeting for ru: "Извините, мне нужна помощь."
```

---

## Additional Considerations

### Future Enhancements (Optional)

1. **Temperature Setting**
   - Consider adding temperature: 0.4-0.5 for more consistent behavior
   - Trade-off: May reduce naturalness slightly

2. **Periodic Role Reinforcement**
   - Could inject system messages every 3-4 exchanges
   - Example: Hidden reminder "Remember: you are the customer"

3. **Post-Session Analytics**
   - Track "role maintenance score" in session analysis
   - Flag sessions where AI may have broken character

### Known Limitations

1. **Model Limitations**
   - Even with perfect prompts, LLMs can occasionally deviate
   - Very creative/determined users might still confuse the AI
   - Solution: Clear instructions to trainees about roleplay rules

2. **Language Coverage**
   - Confusion examples currently provided for: Russian, English, Italian
   - Add more languages as needed in the CONFUSION HANDLING PROTOCOL section

---

## References

- **ElevenLabs Best Practices:** https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide#six-building-blocks
- **Related Issue:** AI breaking character in service training roleplay
- **Implementation Date:** 2025-10-12
- **Implemented By:** Claude Code Assistant

---

## Status

✅ **IMPLEMENTED** - Changes are live and compiled successfully
🧪 **READY FOR TESTING** - Awaiting user validation with real training sessions

### Next Steps

1. Test with the original problematic input
2. Verify AI maintains customer role consistently
3. Collect feedback from actual training sessions
4. Monitor for any edge cases or new issues
5. Consider implementing optional temperature adjustment if needed

---

## Success Metrics

**Before Fix:**
- ❌ AI broke character with ambiguous input
- ❌ Trainees experienced unrealistic scenarios
- ❌ Training effectiveness compromised

**After Fix (Expected):**
- ✅ AI maintains consistent customer role
- ✅ Handles confusion appropriately as customer would
- ✅ Provides realistic, valuable training scenarios
- ✅ Improved training experience and outcomes
