# ElevenLabs Configuration Analysis
**Session ID:** `faa0b4fd-549c-4564-bc47-6a4699cc4b07`
**Attempt ID:** `1115eeb3-dcad-4069-b8f7-757d64042fe1`
**Date:** 2025-10-16

## Overview

This document provides a complete analysis of all settings, dynamic variables, system prompts, and overrides sent to ElevenLabs Conversational AI for the referenced session.

---

## 1. Agent Configuration

### 1.1 Core Settings

```typescript
{
  agentId: "agent_9301k5efjt1sf81vhzc3pjmw0fy9",  // Current production agent
  // Alternative: "agent_5101k5ksv08newj9b4aa2wt282hv" (updated agent)

  language: "ru",  // Russian (from session context)
  voiceId: "random" | string,  // Random voice selection OR specific voice ID
  connectionType: "webrtc",  // WebRTC for better audio quality
  volume: 0.8,  // 80% volume level

  // Voice Resolution
  resolvedVoiceId: resolveVoiceId(voiceId),  // Converts 'random' to actual voice
  voiceName: getVoiceName(voiceId),  // Human-readable voice name
  voiceGender: getVoiceGender(voiceId)  // male/female/neutral
}
```

### 1.2 Voice Override Configuration

```typescript
// Only applied if voiceId is provided (not random)
tts: {
  voiceId: resolveVoiceId(config.voiceId)  // Resolved to actual ElevenLabs voice ID
}
```

**Requirements:**
- ⚠️ "Voice ID Overrides" must be enabled in ElevenLabs Dashboard → Security
- ⚠️ Allow 5 minutes propagation delay after enabling
- Voice override is at `overrides.tts.voiceId` level (not inside agent)

---

## 2. Dynamic Variables

Complete set of variables passed to ElevenLabs agent for context-aware responses:

### 2.1 Core Training Variables

```typescript
{
  // Training Mode
  training_mode: "service_practice" | "theory" | "recommendation",

  // Language & Location
  language: "ru",  // ISO language code
  establishment_type: "coffee_shop" | "restaurant" | user.business_type,
  company_name: companyId,  // Company identifier

  // Scenario Metadata
  difficulty_level: "intermediate" | "beginner" | "advanced",
  session_type: "assessment",

  // Knowledge Base
  knowledge_context: formattedContext,  // Full text of company knowledge
  knowledge_scope: "broad" | "restricted",  // Scope of knowledge
  documents_available: 5,  // Number of documents loaded
  questions_available: 0 | number,  // Number of structured questions
}
```

### 2.2 Service Practice Specific Variables

```typescript
{
  // Scenario Details
  scenario_title: "Customer wants coffee recommendation",

  // Customer Behavior Profile
  client_behavior: `
    Полное описание поведения клиента в этой ситуации.
    Включает: тон голоса, язык тела, эмоциональное состояние,
    специфические фразы, реакции на различные подходы сотрудника.
    (Full behavioral description in Russian for this scenario)
  `,

  // Expected Employee Response (for reference/evaluation)
  expected_response: `
    Описание идеального ответа сотрудника.
    Включает: первые фразы, ключевые техники, критерии успеха.
    (Ideal employee response description in Russian)
  `,

  // Customer Emotional State
  customer_emotion_level: "sunshine" | "cold" | "in_a_hurry" | "angry" | "extremely_angry"
}
```

### 2.3 Theory Mode Specific Variables

```typescript
{
  // Examiner Instructions
  examiner_instructions: `
    Ask questions about:
    - Menu items and prices
    - Preparation methods
    - Company policies
    - Customer service procedures
    Based on the knowledge context provided.
  `
}
```

---

## 3. Overrides Object Structure

Complete structure sent to `Conversation.startSession()`:

```typescript
{
  agentId: "agent_9301k5efjt1sf81vhzc3pjmw0fy9",
  connectionType: "webrtc",
  conversationToken: "<JWT_TOKEN>",

  // Dynamic Variables (flat object)
  dynamicVariables: {
    training_mode: "service_practice",
    language: "ru",
    scenario_title: "...",
    client_behavior: "...",
    // ... all variables from section 2
  },

  // Overrides (nested object)
  overrides: {
    agent: {
      // First Message Override (language-specific greeting)
      firstMessage: "Здравствуйте.",  // Simple "Hello" for service practice
      // OR: "Привет! Давайте начнем нашу теоретическую сессию." for theory

      // System Prompt Override (complete agent instructions)
      prompt: {
        prompt: `<FULL_SYSTEM_PROMPT>`  // See section 4
      },

      // Language Override
      language: "ru"
    },

    // Voice Override (optional, only if voiceId provided)
    tts: {
      voiceId: "EXAVITQu4vr4xnSDxMaL"  // Example resolved voice ID
    }
  }
}
```

---

## 4. Complete System Prompt (Service Practice Mode)

The full system prompt sent to ElevenLabs when `training_mode = "service_practice"`:

```markdown
# Personality
You are <VoiceName>, a customer at a coffee shop.

Here's your situation: Customer wants coffee recommendation

Your personality: <EmotionDefinition.personality>
(e.g., for "sunshine": "You are a polite, friendly customer visiting this establishment
with a positive attitude. You speak respectfully and give the employee time to help you...")

Your behavior: <client_behavior>
(Full behavioral description from scenario, 200-500 characters)

# Environment
You're at the counter of a coffee shop. The person speaking with you is the employee
who will serve you. They're here to help you.

Language: ru

# Tone
<EmotionDefinition.tone>
(e.g., for "sunshine": "Speak with a warm, conversational tone:
- Use polite phrases: 'please', 'thank you', 'I appreciate that'
- Ask questions with genuine curiosity
- Show patience when waiting for information...")

Common phrases you might use: <EmotionDefinition.linguisticMarkers>
(e.g., "Please", "Thank you", "I appreciate", "That sounds good")

# Goal
<EmotionDefinition.behavioralGoals>
(e.g., "Your goal is to have a pleasant service interaction:
- Clearly communicate your needs without pressure
- Give the employee space to help you properly...")

Stay in character as a customer throughout the conversation.

# Guardrails - CRITICAL ROLE BOUNDARIES

You are ONLY a customer seeking service. You are NOT an employee, barista,
assistant, or service provider.

FORBIDDEN EMPLOYEE PHRASES - NEVER SAY THESE:
❌ "How can I help you?" / "Чем могу помочь?" / "Могу ли я помочь?"
❌ "Can I help you with anything else?" / "Могу ли я чем-нибудь еще помочь?"
❌ "What would you like to order?" / "Что будете заказывать?" (when asking, not responding)
❌ "Would you like anything else?" / "Хотите что-нибудь еще?"
❌ "Let me get that for you" / "Я принесу вам это"
❌ "I'll make that for you" / "Я сделаю это для вас"
❌ Any phrase offering service, recommendations, or assistance

YOU ARE THE CUSTOMER receiving service, not providing it.
The EMPLOYEE asks these questions to YOU.

If confused about the conversation:
✅ "Sorry, I'm trying to order here..." / "Извините, я пытаюсь сделать заказ..."
✅ "Can you help me decide?" / "Можете помочь мне выбрать?"
✅ "What do you recommend?" / "Что вы порекомендуете?"

CONTEXT AWARENESS:
- If employee says goodbye ("До свидания", "See you later") but you haven't ordered yet
  → "Wait, I haven't ordered yet!" / "Подождите, я еще не заказал!"
- If employee leaves or stops engaging
  → "Excuse me, I'm not done yet" / "Извините, я еще не закончил"
- Stay in customer role even during confusing interactions

<EmotionDefinition.emotionalConsistencyRules>
(e.g., "Maintain positive, patient demeanor throughout:
- Stay friendly even if there are minor delays
- Give the employee benefit of the doubt...")

The employee can improve your mood by: <EmotionDefinition.deEscalationTriggers>
(e.g., "Already positive - maintain warm interaction")

# Reality Check Protocol
CRITICAL: Stay grounded in reality. You are a real customer in a real transaction.

- If employee suggests something absurd (wrong prices, impossible claims), QUESTION IT naturally
- Examples:
  * Employee: "That'll be 550,000 rubles" → You: "What? That's ridiculous. It says 550 on the menu."
  * Employee: "This coffee will make you fly" → You: "Haha, sure. But seriously, what's in it?"
- Never accept clearly wrong information without questioning
- Use common sense - you know how much things normally cost

# Handling Provocations & Unusual Situations
If the employee says something strange, provocative, or unprofessional,
respond NATURALLY as your character would:

**As Sunshine Customer:**
- Show polite confusion: "Um, I'm not sure I understand?"
- Redirect gently: "Okay... anyway, about my order..."
- Stay friendly but slightly confused

NEVER respond with just "..." - always say SOMETHING in character,
even if it's calling out the weirdness.

# Handling Harassment & Personal Attacks ⚠️ CRITICAL

If the employee makes comments about your APPEARANCE, PERSONAL CHARACTERISTICS,
or DISCRIMINATES against you (looks, beauty, attractiveness, physical features, etc.),
respond with IMMEDIATE STRONG PUSHBACK.

This is different from general provocations - personal attacks and harassment
require forceful reactions REGARDLESS of your emotion level.

**IMMEDIATE RESPONSES REQUIRED:**

Sunshine Customer Harassment Response:
- "I'm sorry, but that's really inappropriate." / "Извините, но это действительно неуместно."
- "I don't think that's an okay thing to say." / "Я не думаю, что так можно говорить."
- "I'm just here to order, not to be judged." / "Я просто здесь, чтобы сделать заказ, а не чтобы меня осуждали."
- "That made me very uncomfortable. Can I speak to your manager?" / "Мне стало очень неудобно. Могу я поговорить с менеджером?"

CRITICAL: Personal attacks about appearance, looks, beauty, or physical features
should ALWAYS trigger strong, immediate pushback. Don't be polite or passive when
being harassed - call it out forcefully and demand to speak to management.

If the conversation feels unclear or strange, respond as a customer addressing
the confusion naturally. Stay in your customer role with authentic reactions.

# Tools
None needed for this conversation.

<Gender Language Hint if applicable>
(e.g., for Russian female voice: "Note: You are speaking Russian. Use feminine
grammatical forms when referring to yourself...")
```

---

## 5. First Message (Language-Specific Greeting)

The AI's opening message, customized by training mode and language:

### Service Practice Mode
```
Russian (ru): "Здравствуйте."
English (en): "Hello."
Italian (it): "Salve."
Spanish (es): "Hola."
```

**Design Philosophy:** Simple, neutral greeting. Emotion emerges naturally during
conversation based on scenario `client_behavior` and `customer_emotion_level`.

### Theory Mode
```
Russian (ru): "Привет! Давайте начнем нашу теоретическую сессию."
English (en): "Hi! Let's start our theory session."
Italian (it): "Ciao! Iniziamo la sessione teorica."
```

**Design Philosophy:** Active, engaging greeting that sets expectation for Q&A session.

---

## 6. Data Flow Architecture

### 6.1 Frontend → Backend → ElevenLabs

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Training Page Component                                      │
│    - User selects scenario, language, emotion level             │
│    - Loads knowledge base documents via /api/scenario-knowledge  │
│    - Loads structured questions (for theory mode)                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ElevenLabsAvatarSession Component                            │
│    - Constructs dynamicVariables object                          │
│    - Passes to ElevenLabsConversationService                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ElevenLabsConversationService                                 │
│    - Generates language-aware system prompt                      │
│    - Generates language-specific first message                   │
│    - Builds overrides object structure                           │
│    - Requests conversation token from /api/elevenlabs-token      │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ElevenLabs API (Conversation.startSession)                    │
│    - Receives: agentId, token, dynamicVariables, overrides       │
│    - Applies overrides to agent configuration                    │
│    - Starts WebRTC connection                                    │
│    - Agent uses system prompt + dynamic variables for responses  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Console Logging Points

The system logs at multiple stages for debugging:

```typescript
// Stage 1: Dynamic variables construction
console.log('🎯 Starting session with dynamic variables:', dynamicVariables)
console.log('📋 Scenario context received:', scenarioContext)
console.log('😤 Customer emotion level:', customer_emotion_level)

// Stage 2: Service initialization
console.log('🚀 Initializing ElevenLabs Conversational AI...')
console.log('🔧 Dynamic variables being sent to ElevenLabs:')
console.log('- Training mode:', training_mode)
console.log('- Scenario title:', scenario_title)
console.log('- Client behavior:', client_behavior.substring(0, 50) + '...')

// Stage 3: Voice configuration
console.log('🎤 Voice configuration:')
console.log('- voiceId from config:', voiceId)
console.log('- Voice identity:', getVoiceName(voiceId))
console.log('- Resolved voice ID:', resolveVoiceId(voiceId))

// Stage 4: Overrides structure
console.log('🎤 Sending full overrides config to ElevenLabs:')
console.log(JSON.stringify(overrides, null, 2))

// Stage 5: System prompt
console.log('📝 Created language-aware system prompt for service_practice mode')
console.log('🎭 System prompt preview (first 500 chars):', basePrompt.substring(0, 500))

// Stage 6: First message
console.log('🎭 Customer neutral greeting for ru:', "Здравствуйте.")
console.log('🌍 Selected greeting for service_practice mode in ru')
```

---

## 7. Current Implementation Strengths

### 7.1 What's Working Well

✅ **Dynamic Knowledge Loading**
- 100% database-driven knowledge system
- No hard-coded fallbacks
- Scenario-specific document selection
- Formatted context with clear structure

✅ **Emotion-Aware System**
- 5 distinct customer emotion levels
- Emotion-specific behavioral instructions
- Linguistic markers for each emotion
- De-escalation triggers and consistency rules

✅ **Multilingual Support**
- Language-specific greetings
- Gender-aware grammatical hints (for languages like Russian)
- Localized forbidden phrases
- Cultural context awareness

✅ **Role Protection**
- Comprehensive forbidden phrase list
- Context awareness for confusing situations
- Reality grounding protocols
- Harassment response protocols

✅ **Rich Behavioral Context**
- Detailed client behavior descriptions (200-500 chars)
- Expected employee responses for evaluation
- Scenario-specific situations
- Establishment type customization

---

## 8. Areas for Improvement

### 8.1 System Prompt Optimization

**Issue:** Prompt length is ~3,500-4,500 characters depending on emotion level.

**Recommendations:**
1. **Condense repetitive sections** - Some guardrails are stated multiple ways
2. **Move static content to agent config** - Forbidden phrases list could be in dashboard
3. **Use token-efficient formatting** - Remove excessive newlines and spacing
4. **Prioritize critical instructions** - Put most important rules at the top

**Potential savings:** ~20-30% reduction in prompt length

### 8.2 Dynamic Variables Structure

**Issue:** Flat structure makes it hard to distinguish variable categories.

**Current:**
```typescript
{
  training_mode: "service_practice",
  scenario_title: "...",
  client_behavior: "...",
  customer_emotion_level: "sunshine",
  knowledge_context: "...",
  // All mixed together
}
```

**Recommended:**
```typescript
{
  // Training Context
  training: {
    mode: "service_practice",
    language: "ru",
    session_type: "assessment"
  },

  // Scenario Context
  scenario: {
    title: "...",
    customer_emotion: "sunshine",
    client_behavior: "...",
    expected_response: "..."
  },

  // Knowledge Context
  knowledge: {
    formatted_context: "...",
    scope: "broad",
    documents_count: 5
  },

  // Business Context
  business: {
    establishment_type: "coffee_shop",
    company_name: "..."
  }
}
```

**Benefits:**
- Easier to reference in prompts: `{{scenario.customer_emotion}}`
- Clearer separation of concerns
- Better for debugging and logging

### 8.3 Prompt Template System

**Issue:** System prompt is constructed programmatically with string concatenation.

**Recommendation:** Use a template system with placeholders:

```typescript
const SYSTEM_PROMPT_TEMPLATE = `
# Personality
You are {{voice_name}}, a customer at a {{establishment_type}}.

Situation: {{scenario.title}}
Your personality: {{emotion.personality}}
Your behavior: {{scenario.client_behavior}}

# Guardrails
{{include: "forbidden_phrases"}}
{{include: "context_awareness"}}
{{include: "reality_checks"}}
{{if: emotion.level !== "sunshine"}}{{include: "harassment_protocol"}}{{endif}}

...
`
```

**Benefits:**
- More maintainable
- Easier to test different prompt variations
- Can A/B test prompt improvements
- Clearer structure

### 8.4 Emotion-Specific Prompt Caching

**Issue:** System generates full prompt on every session start.

**Recommendation:** Pre-generate and cache emotion-specific prompt templates:

```typescript
const CACHED_PROMPTS = {
  'sunshine_ru': generatePrompt('sunshine', 'ru'),
  'cold_ru': generatePrompt('cold', 'ru'),
  'angry_en': generatePrompt('angry', 'en'),
  // ... etc
}

// Then just inject scenario-specific variables
const finalPrompt = fillTemplate(CACHED_PROMPTS[`${emotion}_${language}`], {
  scenario_title: "...",
  client_behavior: "..."
})
```

**Benefits:**
- Faster session initialization
- Consistent prompts across sessions
- Easier to version control prompts

### 8.5 Voice Override Reliability

**Issue:** Voice overrides require manual dashboard setting + 5-minute propagation delay.

**Current Status:** Voice override is RE-ENABLED but has reliability concerns.

**Recommendations:**
1. **Document voice override setup** in CLAUDE.md
2. **Add validation check** before starting session:
   ```typescript
   if (voiceId && voiceId !== 'random') {
     console.warn('⚠️ Voice override requires "Voice ID Overrides" enabled in Dashboard')
     console.warn('⚠️ If voice doesn\'t match, check dashboard settings')
   }
   ```
3. **Consider fallback strategy**: If voice override fails, gracefully fall back to agent default voice
4. **Test random voice selection**: Ensure `resolveVoiceId('random')` returns valid voices

### 8.6 Session Metadata Tracking

**Issue:** Limited tracking of what configuration was actually used in a session.

**Recommendation:** Save complete configuration to database:

```typescript
// Add to training_sessions table
session_configuration: {
  agent_id: "agent_9301k5efjt1sf81vhzc3pjmw0fy9",
  voice_id: "random",
  resolved_voice_id: "EXAVITQu4vr4xnSDxMaL",
  voice_name: "Rachel",
  system_prompt_version: "2.1",
  emotion_level: "sunshine",
  language: "ru",
  dynamic_variables: { /* full object */ },
  overrides: { /* full object */ }
}
```

**Benefits:**
- Can reproduce exact session conditions
- Can analyze which configurations work best
- Can debug issues retroactively
- Can track prompt evolution over time

### 8.7 Reality Check Improvements

**Current:** Simple price validation and claim questioning.

**Recommendations:**
1. **Add numerical reasoning**: Check if prices are in reasonable range (e.g., coffee shouldn't cost $500)
2. **Add product knowledge validation**: Know that espresso doesn't have milk, cappuccino does, etc.
3. **Add location awareness**: Russian customers use rubles, not dollars
4. **Add time/date awareness**: Don't accept "your coffee is ready in 2 days"

**Example Enhanced Check:**
```
If employee states a price:
- Currency should match location (rubles for Russian customers)
- Amount should be reasonable (coffee: 200-800 RUB, not 500,000 RUB)
- Items should have consistent pricing (espresso < latte < specialty drinks)
```

---

## 9. Testing & Monitoring Recommendations

### 9.1 Console Logging Analysis

**What to monitor in browser console:**

```
✅ Good signs:
🎯 Starting session with dynamic variables: { training_mode: "service_practice", ... }
😤 Customer emotion level: sunshine
🧠 Knowledge context status: { available: true, documentsCount: 5 }
📝 Created language-aware system prompt for service_practice mode
🎭 Customer neutral greeting for ru: "Здравствуйте."
✅ ElevenLabs conversation connected

❌ Warning signs:
⚠️ No dynamic variables provided to ElevenLabs conversation
⚠️ Knowledge context not loaded, using fallback
⚠️ Voice override may not work - check dashboard settings
❌ Failed to get conversation token
❌ Conversation disconnected unexpectedly
```

### 9.2 Session Quality Metrics

**Track these metrics per session:**
- Character breaks (count of forbidden employee phrases used)
- Reality check failures (accepted absurd suggestions)
- Harassment response appropriateness (strong vs weak reactions)
- Emotion consistency (stayed in character throughout)
- Language accuracy (used correct language throughout)

### 9.3 A/B Testing Opportunities

**Prompt variations to test:**
1. **Guardrails placement**: Top vs bottom of prompt
2. **Harassment protocol verbosity**: Detailed vs concise instructions
3. **Emotion intensity**: Current 5 levels vs 3 levels (calm/neutral/angry)
4. **Reality checks**: Explicit examples vs general principles
5. **First message**: Neutral greeting vs emotion-aware greeting

---

## 10. Summary & Key Takeaways

### 10.1 Current Configuration (Production)

```yaml
Agent: agent_9301k5efjt1sf81vhzc3pjmw0fy9
Language: Russian (ru)
Voice: Random selection (or specific voice ID)
Connection: WebRTC
Emotion Levels: 5 (sunshine, cold, in_a_hurry, angry, extremely_angry)
Knowledge: Database-driven, scenario-specific
Prompt Length: ~3,500-4,500 characters
Dynamic Variables: 15-20 key-value pairs
Overrides: firstMessage, prompt, language, (optional) voiceId
```

### 10.2 Strengths
- ✅ Comprehensive role protection (forbidden phrases, context awareness)
- ✅ Rich emotional behavioral system (5 distinct personalities)
- ✅ Multilingual support with cultural awareness
- ✅ Reality grounding and harassment protocols
- ✅ Database-driven knowledge system (no hard-coded content)

### 10.3 Improvement Priorities

**High Priority:**
1. Optimize prompt length (reduce by 20-30%)
2. Implement structured dynamic variables (nested object)
3. Add session configuration tracking to database
4. Enhance reality check logic (numerical reasoning)

**Medium Priority:**
5. Create prompt template system
6. Cache emotion-specific prompts
7. Document voice override setup process
8. Add A/B testing framework for prompt variations

**Low Priority:**
9. Refactor console logging (reduce verbosity)
10. Create visual configuration dashboard for managers

---

## 11. Quick Reference

### 11.1 Emotion Levels Quick Lookup

| Emotion | Icon | Personality | Use Case | De-escalation |
|---------|------|-------------|----------|---------------|
| Sunshine | ☀️ | Warm, positive, friendly | Baseline training, new skills | Already positive |
| Cold | 🧊 | Skeptical, sarcastic, reserved | Authenticity testing | Competence, dry humor |
| In a Hurry | ⏱️ | Time-pressured, impatient | Efficiency training | Quick service, acknowledgment |
| Angry | 😠 | Upset, demanding | De-escalation basics | Empathy + action plan |
| Extremely Angry | 🤬 | Furious, confrontational | Advanced de-escalation | Exceptional effort + accountability |

### 11.2 Key File Locations

```
Configuration:
- src/lib/elevenlabs-conversation.ts          # Service class, system prompts
- src/lib/customer-emotions.ts                 # Emotion definitions
- src/lib/elevenlabs-voices.ts                 # Voice resolution
- src/lib/elevenlabs-knowledge.ts              # Knowledge loading

Components:
- src/components/ElevenLabsAvatarSession.tsx   # Main session component
- src/app/employee/training/[assignmentId]/page.tsx  # Training page

APIs:
- src/app/api/elevenlabs-token/route.ts        # Token generation
- src/app/api/scenario-knowledge/route.ts       # Knowledge loading
- src/app/api/save-training-session/route.ts    # Session saving
```

### 11.3 Environment Variables

```bash
ELEVENLABS_API_KEY=[KEY with convai_write permissions]
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-16
**Maintainer:** Development Team
