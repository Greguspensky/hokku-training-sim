# Customer Roleplay System Improvements - October 13, 2025

## Overview

Complete refactoring of the ElevenLabs customer roleplay system to fix critical bugs and follow best practices. This document covers three major improvements implemented in sequence.

---

## Table of Contents

1. [Bug Fixes: Scenario Context & Role Confusion](#bug-fixes-scenario-context--role-confusion)
2. [Voice Gender Awareness System](#voice-gender-awareness-system)
3. [Company Establishment Type System](#company-establishment-type-system)
4. [Prompt Refactoring (ElevenLabs Best Practices)](#prompt-refactoring-elevenlabs-best-practices)
5. [Testing Guide](#testing-guide)
6. [Technical Reference](#technical-reference)

---

## Bug Fixes: Scenario Context & Role Confusion

### Problem #1: AI Following Opposite Instructions

**Issue:**
AI agent was giving opposite recommendations from what the scenario specified.

**Example:**
- **Scenario:** Customer wants sweet, acidic, strong coffee (lactose allergy, didn't sleep all night)
- **AI Response:** "I'd like something not too strong, not too sweet, maybe with milk" ❌

**Root Cause:**
The emotion-based system prompt only included `client_behavior` (HOW to act) but not `scenario_title` (WHAT the customer wants).

```typescript
// BEFORE (Missing scenario title)
basePrompt = `# YOUR SCENARIO
${dynamicVariables?.client_behavior || 'You are a customer seeking help'}
`

// AFTER (Complete context)
basePrompt = `# YOUR SCENARIO
SITUATION:
${dynamicVariables?.scenario_title || 'You are visiting this establishment'}

YOUR BEHAVIOR:
${dynamicVariables?.client_behavior || 'You are a customer seeking help'}
`
```

**Fix Applied:**
- Added `scenario_title` to `dynamicVariables` in `ElevenLabsAvatarSession.tsx`
- Updated prompt builder to include BOTH situation and behavior

### Problem #2: AI Acting as Barista Instead of Customer

**Issue:**
AI started conversations with: **"Здравствуйте! Чем я могу вам помочь сегодня?"** (How can I help you today?)

This is a barista greeting, not a customer greeting.

**Root Cause:**
Role boundaries were buried deep in a 3,500+ character prompt and not prominent enough.

**Fix Applied:**
- Moved role boundaries to top of prompt (immediately after scenario)
- Added explicit examples: "NEVER ask 'How can I help you?' - that's the employee's job"
- Strengthened role reminders throughout prompt
- Added final role reminder at end

**Files Modified:**
1. `src/components/ElevenLabsAvatarSession.tsx` (line 334) - Added scenario_title
2. `src/lib/elevenlabs-conversation.ts` (lines 132-205) - Restructured prompt

**Commit:** `836c620`

---

## Voice Gender Awareness System

### Problem: Gender-Specific Language Errors

**Issue:**
AI couldn't use correct gendered language for languages like Russian, Spanish, French, Italian, and Polish.

**Example (Russian):**
- **Female voice (Klava):** Should say "я согласна" (feminine) ✅
- **Male voice (Vlad):** Should say "я согласен" (masculine) ✅
- **Before fix:** AI used random gender, often incorrect ❌

### Solution: Voice Gender Detection & Language Hints

#### 1. Voice Gender Mapping

**File:** `src/lib/elevenlabs-voices.ts` (lines 67-130)

```typescript
export function getVoiceGender(voiceId: string): 'female' | 'male' | 'neutral' {
  const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId)

  // Female voices: Klava, Karina
  if (voice?.name === 'Klava' || voice?.name === 'Karina') {
    return 'female'
  }

  // Male voices: Sanyok, Vlad
  if (voice?.name === 'Sanyok' || voice?.name === 'Vlad') {
    return 'male'
  }

  return 'neutral'
}
```

#### 2. Language-Specific Gender Hints

**Supported Languages:**

| Language | Female Example | Male Example |
|----------|---------------|--------------|
| **Russian (ru)** | "я согласна" | "я согласен" |
| **Spanish (es)** | "estoy cansada" | "estoy cansado" |
| **French (fr)** | "je suis fatiguée" | "je suis fatigué" |
| **Italian (it)** | "sono stanca" | "sono stanco" |
| **Polish (pl)** | "jestem zmęczona" | "jestem zmęczony" |

**Non-gendered languages** (no hint needed): English, Chinese, Japanese, Korean

#### 3. Voice Identity in Prompt

**BEFORE:**
```
# Personality
You are a calm customer.
```

**AFTER:**
```
# Personality
You are Klava, a customer at a coffee shop.
```

#### 4. Gender Hint at End of Prompt

```
---

Language note: You are speaking as a female. In Russian, use feminine verb endings: "я согласна", "я пришла", "я хотела бы"
```

### Implementation Details

**Files Modified:**
1. `src/lib/elevenlabs-voices.ts` - Added `getVoiceGender()` and `getGenderLanguageHint()`
2. `src/lib/elevenlabs-conversation.ts` - Integrated voice identity into prompt
3. Enhanced console logging to show voice identity and gender

**Commit:** `9f22686` (first half)

---

## Company Establishment Type System

### Problem: Hardcoded "Coffee Shop"

**Issue:**
All scenarios defaulted to "coffee shop" with no way to configure other business types (bank, restaurant, hotel, retail, etc.).

### Solution: Company-Level Business Type Configuration

#### 1. Database Schema

**New Column:** `business_type` in `companies` table

```sql
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'coffee_shop';
```

**Suggested Values:**
- `coffee_shop` - Coffee shops, cafes
- `restaurant` - Restaurants, dining
- `bank` - Banks, financial institutions
- `retail_store` - Retail shops, boutiques
- `hotel` - Hotels, hospitality
- `call_center` - Customer service centers
- `healthcare` - Medical facilities, clinics
- `salon` - Hair salons, spas

#### 2. Auth Context Integration

**File:** `src/contexts/AuthContext.tsx`

```typescript
interface ExtendedUser extends User {
  role?: string
  company_id?: string
  company_name?: string
  employee_record_id?: string
  business_type?: string  // NEW
}
```

Fetches `business_type` from companies table in 2 locations:
- Line 129: Existing user fetch
- Line 233: New user creation

#### 3. Prompt Integration

**File:** `src/components/ElevenLabsAvatarSession.tsx` (line 322)

```typescript
// Get establishment type from user's company
const establishmentType = user?.business_type || 'coffee_shop'

const dynamicVariables = {
  // ...
  establishment_type: establishmentType,  // Passed to agent
  // ...
}
```

**File:** `src/lib/elevenlabs-conversation.ts` (line 123, 142)

```typescript
// Used in prompt
const establishmentType = dynamicVariables?.establishment_type || 'coffee shop'

basePrompt = `# Personality
You are ${customerName}, a customer at a ${establishmentType}.
...
# Environment
You're at the counter of a ${establishmentType}. The person speaking with you is the employee who will serve you.
`
```

### Usage

**Step 1: Run Database Migration**
```bash
psql "$DATABASE_URL" < add-business-type-to-companies.sql
```

**Step 2: Set Company Business Type**
```sql
UPDATE companies
SET business_type = 'bank'
WHERE id = 'your-company-id';
```

**Step 3: Reload & Test**
- Reload the page to refresh auth cache
- Start a service practice session
- AI will say "at a bank" instead of "at a coffee shop"

### Implementation Details

**Files Modified:**
1. `src/lib/elevenlabs-voices.ts` - Voice gender helpers
2. `src/contexts/AuthContext.tsx` - Load business_type
3. `src/components/ElevenLabsAvatarSession.tsx` - Pass establishment_type
4. `src/lib/elevenlabs-conversation.ts` - Use in prompt
5. **NEW:** `add-business-type-to-companies.sql` - Database migration

**Commit:** `9f22686`

---

## Prompt Refactoring (ElevenLabs Best Practices)

### Problem: Over-Engineered Prompt Structure

**Issues:**
1. Too many meta-instructions: "CRITICAL:", "ABSOLUTE:", "FINAL REMINDER:"
2. Training meta-commentary broke immersion: "This is voice-based roleplay training"
3. Role boundaries repeated 4 times throughout prompt
4. Prompt length: ~3,500 characters (too long, dilutes key instructions)

### Solution: Clean ElevenLabs Six Building Blocks Structure

Following [ElevenLabs best practices documentation](https://elevenlabs.io/docs/agents-platform/best-practices):

```
# Personality - Who you are and your situation
# Environment - Where you are
# Tone - How you speak
# Goal - What you want to achieve
# Guardrails - Boundaries (consolidated into ONE section)
# Tools - Available tools (none)
```

### BEFORE vs AFTER Comparison

#### BEFORE (3,500 characters):
```
# YOUR SCENARIO - THIS IS WHAT ACTUALLY HAPPENED

SITUATION:
[scenario]

YOUR BEHAVIOR:
[behavior]

CRITICAL: The scenario above defines YOUR ACTUAL SITUATION and BEHAVIOR...
Everything below tells you HOW to express your emotions...

# YOUR ROLE - READ THIS CAREFULLY
You are the CUSTOMER in this roleplay. The human is the EMPLOYEE.
You came here SEEKING SERVICE - you are NOT here to provide service.

ABSOLUTE ROLE BOUNDARIES (NEVER VIOLATE):
- You are ONLY a customer seeking service
- You are NOT an employee, assistant, barista, server...
- NEVER ask "How can I help you?" - that's the employee's job
- NEVER offer recommendations, services, or assistance
- If confused about what to say, ASK FOR HELP as a customer would

# Environment
You are at the counter of a coffee shop, speaking with the employee...
This is voice-based roleplay training.

Language: Russian

# Personality
You are Klava, a calm customer at a coffee shop.
[personality text]

You are NOT an employee - you came here as a paying customer seeking service.

Emotional State: calm

# Tone
[tone text]

LINGUISTIC MARKERS TO USE:
- "Please"
- "Thank you"
- "I appreciate"
[7 more items]

# Goal
[goal text]

Your primary objective is to remain consistently in the customer role...
NEVER switch to providing service - you are always the one receiving service.

# Guardrails - Emotional Consistency
[consistency rules]

DE-ESCALATION CONDITIONS:
The employee can improve your mood by: [triggers]

CONFUSION HANDLING PROTOCOL:
- If user input is unclear → Respond as customer asking for clarification
- If role ambiguity occurs → Reinforce your customer position naturally
- NEVER interpret confusion as permission to switch roles
- If you don't know what to say, ASK THE EMPLOYEE FOR HELP

COMPANY KNOWLEDGE (for evaluating employee responses):
[knowledge context]

# Tools
[None needed for this roleplay scenario]

Training mode: service_practice
Emotional Level: calm
Available documents: 1

LANGUAGE NOTE: [gender hint]

FINAL ROLE REMINDER: You are the CUSTOMER named Klava. The human is the EMPLOYEE...
```

#### AFTER (2,200 characters - 37% reduction):
```
# Personality
You are Klava, a customer at a coffee shop.

Here's your situation: You're visiting for the first time and looking for an unusual coffee. You have a lactose allergy and want something sweet with acidity, but strong, because you didn't sleep all night.

Your personality: You're polite and friendly, genuinely interested in the products. You speak respectfully and give the employee time to help you. You ask questions when curious and express gratitude when helped.

Your behavior: Calm, tired, asks many times

# Environment
You're at the counter of a coffee shop. The person speaking with you is the employee who will serve you. They're here to help you.

Language: Russian

# Tone
Speak with a warm, conversational tone. Use polite phrases like "please" and "thank you". Ask questions with genuine curiosity. Show patience when waiting for information. Express satisfaction naturally when something sounds good.

Common phrases you might use: Please, Thank you, I appreciate, That sounds good, Could you tell me...?

# Goal
Have a pleasant service interaction. Clearly communicate your coffee needs - you want something sweet with acidity, strong, and without lactose. Give the employee space to help you properly. Ask follow-up questions if you need clarification. Make a decision when you're ready.

Stay in character as a customer throughout the conversation.

# Guardrails
You are ONLY a customer seeking service. You are NOT an employee, barista, assistant, or service provider.

Never ask "How can I help you?" - that's the employee's line. Never offer coffee recommendations or services. If you're confused about what to say, ask the employee for help - you're the customer!

Maintain your calm, polite demeanor throughout. Stay friendly even if there are minor delays. Give the employee the benefit of the doubt. The employee can keep your mood positive by providing helpful, efficient service.

If the conversation feels unclear, respond as a customer asking for clarification. Stay in your customer role naturally.

# Tools
None needed for this conversation.

---

Language note: You are speaking as a female. In Russian, use feminine verb endings: "я согласна", "я пришла", "я хотела бы"
```

### Key Improvements

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Length** | 3,500 chars | 2,200 chars | 37% reduction |
| **Meta-commentary** | Heavy | None | More immersive |
| **Role reminders** | 4 sections | 1 section | Consolidated |
| **Headers** | Shouty (CRITICAL) | Professional | Cleaner |
| **Language** | Instructional | Conversational | More natural |
| **Linguistic markers** | Bulleted list (12) | Inline text (5) | Cleaner |

### What Was Preserved

✅ Voice name and gender system
✅ Establishment type system
✅ Complete scenario context
✅ All emotion definitions
✅ All role boundaries
✅ De-escalation triggers
✅ Language-specific gender hints

### Implementation Details

**File Modified:**
- `src/lib/elevenlabs-conversation.ts` (lines 129-170)

**Changes:**
- 1 file changed, 18 insertions(+), 53 deletions(-)
- Net reduction: 35 lines of code

**Commit:** `60b2b0e`

---

## Testing Guide

### Test #1: Scenario Context (Bug Fix)

**Objective:** Verify AI follows scenario instructions correctly

**Steps:**
1. Create service practice scenario with specific customer requirements
2. Example: "Customer wants sweet, acidic, strong coffee (lactose allergy)"
3. Start session
4. **Expected:** AI should request exactly what's in the scenario
5. **Verify:** AI doesn't say opposite things

### Test #2: Role Consistency (Bug Fix)

**Objective:** Verify AI maintains customer role

**Steps:**
1. Start any service practice session
2. Listen to AI's first message
3. **Expected:** AI should NOT say "How can I help you?" or offer service
4. **Expected:** AI should present their problem/need as a customer
5. **Verify:** AI stays in customer role throughout conversation

### Test #3: Voice Gender (Russian)

**Objective:** Verify correct Russian verb endings

**Steps:**
1. Create service practice scenario
2. Select **Russian** language
3. Select voice: **Klava** (female)
4. Start session
5. **Check console logs:**
   ```
   🎤 Voice identity: Klava (female)
   📝 System prompt preview: ...Language note: ...feminine verb endings...
   ```
6. **Expected AI responses:** "я согласна", "я пришла", "я хотела бы"

**Repeat with male voice:**
1. Select voice: **Vlad** (male)
2. **Expected AI responses:** "я согласен", "я пришёл", "я хотел бы"

### Test #4: Establishment Type

**Objective:** Verify dynamic business type

**Step 1: Run Database Migration**
```bash
psql "$DATABASE_URL" < add-business-type-to-companies.sql
```

**Step 2: Set Business Type**
```sql
UPDATE companies
SET business_type = 'bank'
WHERE id = 'a335f162-53f9-4aa4-be5b-46a7ce090483';
```

**Step 3: Test**
1. Reload page (refresh auth cache)
2. Start service practice session
3. **Check console logs:**
   ```
   🎤 Voice configuration:
   - Establishment type: bank
   ```
4. **Expected in prompt:** "You are Klava, a customer at a bank"
5. **Expected in environment:** "You're at the counter of a bank"

### Test #5: Prompt Quality

**Objective:** Verify cleaner, more natural prompt

**Steps:**
1. Start any service practice session
2. **Check console logs** for prompt preview
3. **Verify:**
   - ✅ No "Training mode:" meta-commentary
   - ✅ No "CRITICAL:", "ABSOLUTE:", "FINAL REMINDER" headers
   - ✅ Natural language: "Here's your situation:"
   - ✅ Voice name used: "You are Klava"
   - ✅ Establishment type used: "at a coffee shop"
   - ✅ Gender hint at bottom (if gendered language)

---

## Technical Reference

### Files Modified (Summary)

| File | Changes | Purpose |
|------|---------|---------|
| `src/lib/elevenlabs-voices.ts` | +67 lines | Voice gender detection & language hints |
| `src/lib/elevenlabs-conversation.ts` | -35 lines | Prompt refactoring + voice integration |
| `src/contexts/AuthContext.tsx` | +8 lines | Load business_type from database |
| `src/components/ElevenLabsAvatarSession.tsx` | +3 lines | Pass scenario_title & establishment_type |
| `add-business-type-to-companies.sql` | NEW | Database migration |

### Commits

1. **`836c620`** - Fix scenario context and role guardrails
2. **`9f22686`** - Add voice gender awareness and establishment type system
3. **`60b2b0e`** - Refactor prompt to match ElevenLabs best practices

### Console Logs Reference

**Voice Configuration:**
```
🎤 Voice configuration:
- voiceId from config: kdmDKE6EkgrWrrykO9Qt
- Voice identity: Klava (female)
- Establishment type: coffee_shop
- Resolved voice ID: kdmDKE6EkgrWrrykO9Qt
```

**Dynamic Variables:**
```
🔧 Dynamic variables being sent to ElevenLabs:
- Training mode: service_practice
- Voice ID: kdmDKE6EkgrWrrykO9Qt (Klava, female)
- Establishment type: coffee_shop
- Scenario title: Client asks questions, came for first time...
- Client behavior: Calm, tired, asks many times
```

**System Prompt Preview:**
```
🎭 System prompt preview (first 500 chars):
# Personality
You are Klava, a customer at a coffee shop.

Here's your situation: You're visiting for the first time...
```

### Database Schema

**Companies Table:**
```sql
companies (
  id UUID PRIMARY KEY,
  name TEXT,
  business_type TEXT DEFAULT 'coffee_shop',  -- NEW
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Suggested business_type Values:**
- `coffee_shop`, `restaurant`, `bank`, `retail_store`, `hotel`, `call_center`, `healthcare`, `salon`

### Voice Gender Mapping

| Voice ID | Voice Name | Gender | Description |
|----------|------------|--------|-------------|
| `kdmDKE6EkgrWrrykO9Qt` | Klava | Female | Professional female voice |
| `Jbte7ht1CqapnZvc4KpK` | Karina | Female | Warm female voice |
| `mOTbMAOniC3yoEvgo4bi` | Sanyok | Male | Friendly male voice |
| `RUB3PhT3UqHowKru61Ns` | Vlad | Male | Authoritative male voice |

### Gender Hints by Language

| Language Code | Language | Gender Hint Provided |
|---------------|----------|---------------------|
| `ru` | Russian | ✅ Yes |
| `es` | Spanish | ✅ Yes |
| `fr` | French | ✅ Yes |
| `it` | Italian | ✅ Yes |
| `pl` | Polish | ✅ Yes |
| `en` | English | ❌ No (not gendered) |
| `zh` | Chinese | ❌ No (not gendered) |
| `ja` | Japanese | ❌ No (not gendered) |
| `ko` | Korean | ❌ No (not gendered) |

---

## Best Practices & Recommendations

### For Managers

1. **Set Business Type:** Update your company's `business_type` in the database to match your actual business
2. **Voice Selection:** Choose appropriate voice gender for your language (female voices for better Russian feminine endings)
3. **Scenario Writing:** Be specific in scenario `title` field - AI will follow these instructions exactly
4. **Testing:** Test scenarios before assigning to employees to ensure AI behavior is correct

### For Developers

1. **Prompt Changes:** Always test with multiple emotion levels after modifying prompts
2. **Voice Integration:** When adding new voices, update `getVoiceGender()` with correct gender
3. **Language Support:** When adding new gendered languages, add hints to `getGenderLanguageHint()`
4. **Database Migrations:** Always run `add-business-type-to-companies.sql` on new environments

### For AI Behavior

1. **Shorter is Better:** Keep prompts under 2,500 characters for best AI focus
2. **Natural Language:** Use conversational tone, not instructional commands
3. **Consolidate Rules:** Put all boundaries in one Guardrails section
4. **No Meta-commentary:** Don't tell AI it's training - keep immersion
5. **Specific Examples:** Give concrete examples of what NOT to say

---

## Troubleshooting

### Issue: AI Still Acts as Barista

**Symptoms:** AI says "How can I help you?" or offers service

**Solution:**
1. Check if scenario has `customer_emotion_level` set (triggers new prompt)
2. Verify console shows voice identity and gender
3. Check system prompt preview in console - should show clean ElevenLabs structure
4. If still failing, check if emotion definitions in `customer-emotions.ts` are correct

### Issue: Wrong Gender Verb Endings

**Symptoms:** Female voice says "я согласен" (masculine)

**Solution:**
1. Check voice ID in console logs
2. Verify `getVoiceGender()` returns correct gender
3. Check language hint appears in prompt preview
4. Verify Russian language is selected (`language: 'ru'`)

### Issue: Still Says "Coffee Shop" Despite Setting Business Type

**Symptoms:** AI says "at a coffee shop" even though business_type is 'bank'

**Solution:**
1. Check if database migration ran: `SELECT business_type FROM companies LIMIT 1;`
2. Verify AuthContext loads business_type (check console logs)
3. Clear browser cache and reload to refresh auth state
4. Check establishment_type in dynamic variables console log

### Issue: Prompt Too Long Error

**Symptoms:** ElevenLabs API errors about prompt length

**Solution:**
1. Check if knowledge_context is too large
2. Verify emotion definitions aren't duplicated
3. Review scenario title length (keep under 500 characters)
4. Check if linguistic markers are being expanded correctly

---

## Future Improvements

### Potential Enhancements

1. **Additional Gendered Languages:**
   - Portuguese (pt): "estou cansada" vs "estou cansado"
   - German (de): "Ich bin müde" (less gendered but still relevant)
   - Hebrew (he): Highly gendered language support

2. **Business Type Templates:**
   - Pre-defined scenario templates per business type
   - Industry-specific linguistic markers
   - Context-aware knowledge base loading

3. **Voice Emotion Matching:**
   - Match voice characteristics to emotion levels
   - Authoritative voices (Vlad) → Angry customers
   - Warm voices (Karina) → Calm customers

4. **Advanced Immersion:**
   - Remove all remaining meta-text
   - Add ambient context ("You hear coffee machines in the background")
   - Dynamic time of day references

5. **Prompt Analytics:**
   - Track which prompts lead to best role consistency
   - A/B testing of prompt structures
   - Automatic prompt optimization

---

## References

- **ElevenLabs Best Practices:** https://elevenlabs.io/docs/agents-platform/best-practices
- **ElevenLabs Six Building Blocks:** Official documentation structure
- **Russian Grammar Reference:** Verb gender conjugation rules
- **Project Documentation:** See `CLAUDE.md` for system overview

---

## Changelog

### October 13, 2025

**Commit `836c620`:**
- ✅ Fixed scenario context bug (missing title field)
- ✅ Fixed role confusion bug (strengthened guardrails)
- ✅ Enhanced console logging

**Commit `9f22686`:**
- ✅ Added voice gender detection system
- ✅ Added language-specific gender hints (5 languages)
- ✅ Added company establishment type system
- ✅ Added database migration for business_type column
- ✅ Integrated voice name into personality

**Commit `60b2b0e`:**
- ✅ Refactored prompt to match ElevenLabs best practices
- ✅ Reduced prompt length by 37% (3,500 → 2,200 chars)
- ✅ Removed all meta-commentary
- ✅ Consolidated role reminders into single section
- ✅ Natural, conversational language throughout

---

## Credits

**Implementation:** Claude Code AI Assistant
**Collaboration:** ElevenLabs Conversational AI Platform
**Testing:** Hokku Training Sim Platform

**Generated with:** [Claude Code](https://claude.com/claude-code)

---

*Last Updated: October 13, 2025*
