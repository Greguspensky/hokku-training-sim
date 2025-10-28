# Claude Instructions for Hokku Training Sim

## Quick Start Commands
```bash
npm run dev  # Start development server on port 3000
```

## Current Project State (2025-10-28)

### Latest Features ✅
- **⚙️ Settings Reorganization (2025-10-28)**: Clean manager dashboard with dedicated settings hub ✅ **COMPLETE**
- **🎤 Language-Aware Voice System (2025-10-28)**: Multi-language voice configuration with intelligent selection ✅ **CODE COMPLETE** ⚠️ **MIGRATION PENDING**
- **📚 Knowledge Base Integration (2025-10-17)**: AI customers only order real menu items ✅ **PRODUCTION READY**
- **🧊 Customer Emotion System Redesign (2025-10-15)**: 5 emotion levels - renamed + NEW "Cold" customer type ✅ **CODE COMPLETE**
- **🤬 Customer Emotional States (2025-10-12 PM)**: Authentic AI behavior with dynamic emotion responses ✅ **TESTED & WORKING**
- **⏱️ Session Time Limit System (2025-10-12 AM)**: Configurable time limits (1-60 minutes) ✅
- **📊 Question Scoring System (2025-10-10)**: Complete mastery tracking per topic ✅
- **🎥 Video Recording**: Records BOTH user voice AND AI agent audio (ElevenLabs + TTS) ✅
- **ElevenLabs AI**: Conversational AI integration COMPLETE and WORKING ✅

### Core Training Systems
- **Theory Q&A**: Agent acts as strict examiner asking scenario-specific questions
- **Recommendation Training**: TTS-based product recommendation sessions with video recording
- **Service Practice**: Hands-on customer service scenario training with emotional states

### Key Technical Features
- **Dynamic Knowledge System**: 100% database-driven content loading
- **AI Assessment Scoring**: Real Q&A evaluation with GPT-4
- **Multilingual Support**: 13 languages with immediate language initialization
- **Mobile Compatible**: Cross-platform video recording (iOS/Android)
- **Progress Tracking**: Automatic mastery calculations per topic

### Key URLs
- Training: http://localhost:3000/employee/training/demo-assignment-1758312913428-7qtmmsq
- Employee Dashboard: http://localhost:3000/employee
- Manager Dashboard: http://localhost:3000/manager
- Session History: http://localhost:3000/employee/history

### 📚 Documentation Library
- **PROJECT_DOCUMENTATION.md** - Complete project overview
- **DATABASE_REFERENCE.md** - Full database schema
- **API_REFERENCE.md** - All API endpoints
- **TROUBLESHOOTING_GUIDE.md** - Common issues and solutions
- **OCTOBER_28_2025_UPDATES.md** - Settings reorganization + Voice system implementation ✅ **NEW**
- **SETTINGS_REORGANIZATION_2025-10-28.md** - Manager settings architecture redesign ✅ **COMPLETE**
- **VOICE_SYSTEM_IMPLEMENTATION_COMPLETE.md** - Language-aware voice configuration system ✅ **CODE COMPLETE**
- **KNOWLEDGE_BASE_FINAL_IMPLEMENTATION.md** - Knowledge base system (menu items in Service Practice) ✅ **PRODUCTION**
- **RAG_KNOWLEDGE_BASE_IMPLEMENTATION.md** - RAG approach (disabled, preserved for future per-company agents)
- **NORMAL_CUSTOMER_MIGRATION_2025-10-20.md** - Normal Customer emotion replaces Sunshine ✅ **COMPLETE**
- **VIDEO_UPLOAD_FIX_2025-10-15.md** - Video size limit fix (200 MB) for long sessions ✅ **FIXED**
- **EMOTION_SYSTEM_UPDATE_2025-10-15.md** - Customer emotion redesign (Sunshine, Cold, In a Hurry) ✅ **COMPLETE**
- **MANAGER_QUESTION_STATUS_FIX_2025-10-15.md** - Manager status update & progress calculation fixes
- **EMOTION_SYSTEM_COMPLETE_2025-10-12.md** - Customer emotional states system (original)
- **VIDEO_RECORDING_SYSTEM_DOCUMENTATION.md** - Video recording technical guide
- **CLAUDE_ARCHIVE_2025.md** - Historical feature documentation (archived)

## ElevenLabs Configuration

### Agent Details
- **Current Agent ID**: `agent_5101k5ksv08newj9b4aa2wt282hv` (UPDATED)
- **Previous Agent**: `agent_9301k5efjt1sf81vhzc3pjmw0fy9` (may still work)
- **Dashboard**: Configured with dynamic variable placeholders
- **API Key**: Has convai_write permissions (confirmed working)

### System Prompt (in ElevenLabs Dashboard)
```
{{examiner_instructions}}

Use this knowledge base to ask questions:
{{knowledge_context}}

Training mode: {{training_mode}}
Available documents: {{documents_available}}

You are operating in {{training_mode}} mode. Follow the examiner instructions above strictly
```

### Knowledge System
**Status**: ✅ Fully Database-Driven
- All knowledge loaded from `knowledge_base_documents` table
- Scenario-specific document assignment via `knowledge_category_ids` and `knowledge_document_ids`
- No hard-coded fallbacks - system validates and warns if knowledge missing
- Works for any business vertical (not limited to coffee shops)

## Environment Variables Required
```bash
NEXT_PUBLIC_SUPABASE_URL=https://tscjbpdorbxmbxcqyiri.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=[CONFIGURED]
OPENAI_API_KEY=[CONFIGURED]
ELEVENLABS_API_KEY=[CONFIGURED with convai_write permissions]
```

## Critical Files Reference

### Latest Features (2025-10-28)
- **`src/lib/voice-resolver.ts`** - Language-aware voice resolution service (NEW)
- **`src/app/api/voice-settings/route.ts`** - Voice management API (NEW)
- **`src/app/manager/settings/`** - Settings hub with General and Voice settings (NEW)
- **`src/components/ScenarioForm.tsx`** - Multi-select voice UI by language
- **`src/components/EditScenarioForm.tsx`** - Multi-select voice UI by language
- **`src/app/manager/page.tsx`** - Cleaned manager dashboard (settings moved)
- **`src/lib/customer-emotions.ts`** - Complete emotion definitions
- **`src/contexts/AuthContext.tsx`** - Auth context with localStorage caching
- **`src/lib/scenarios.ts`** - Scenario service with voice_ids array support

### Core Systems
- **`src/components/ElevenLabsAvatarSession.tsx`** - Theory Q&A component
- **`src/components/RecommendationTTSSession.tsx`** - TTS session with video recording
- **`src/lib/elevenlabs-conversation.ts`** - Conversation service with emotion-aware prompts
- **`src/lib/elevenlabs-knowledge.ts`** - Knowledge service
- **`src/services/VideoRecordingService.ts`** - Video recording with audio mixing
- **`src/app/api/assess-theory-session/route.ts`** - Assessment scoring API
- **`src/app/api/record-question-attempt/route.ts`** - Question attempt recording

## Known Issues Status ⚠️
- **Database Schema**: Missing `avatar_mode` column in `tracks` table (minor, not affecting functionality)
- **Demo UUID Warnings**: Demo scenarios use string IDs (expected, but generates warnings)
- **Stale Auth Cache (2025-10-15)**: If user data is updated in database (e.g., company_id assigned), localStorage cache can become stale, causing "Company ID Missing" errors. **Workaround**: Clear cache via console: `Object.keys(localStorage).filter(k => k.startsWith('user_cache_')).forEach(k => localStorage.removeItem(k)); location.reload()`
  - **Potential fixes**: Auto-clear cache when incomplete, add "Clear Cache" button to error UI, allow managers to proceed without company_id in fallback mode

**All Major Issues FIXED** ✅:
- ✅ **Video Upload Size Limit (2025-10-15 PM)**: Increased Supabase storage limit to 200 MB - supports 10+ minute sessions
- ✅ **Customer Emotion System Redesign (2025-10-15 PM)**: Renamed emotions + NEW "Cold" customer type
- ✅ **Manager Question Status Update (2025-10-15 AM)**: Schema mismatch fixed - now uses `user_id`, `user_answer`, `user_topic_progress`
- ✅ **Progress Calculation (2025-10-15 AM)**: Fixed formula to show correct/total instead of correct/attempted
- ✅ Session Time Limit System working
- ✅ Customer Emotional States working
- ✅ Topic Display in scenario cards
- ✅ Auth State Caching
- ✅ Hard-coded Knowledge removed
- ✅ Question Scoring implemented
- ✅ Progress Tracking working
- ✅ ElevenLabs Agent Audio Capture
- ✅ TTS First Question audio
- ✅ Video Preview fixed
- ✅ Scenario-Specific Question Selection
- ✅ Language-Specific Initialization

## Testing Quick Guide

### Theory Q&A Test
1. Go to employee training page
2. Select "Theory Q&A" mode
3. Choose language (try Russian 🇷🇺)
4. Start session - should ask scenario-specific questions in selected language
5. Answer questions - should see mastery progress update

### Service Practice Test
1. Select "Service Practice" mode
2. Choose customer emotion level (try "Extremely Angry" 🔴)
3. Start session - AI should match selected emotion intensity
4. Practice de-escalation - AI should respond authentically to your approach

### Recommendation Training Test
1. Select "Recommendation" mode
2. Start session - video recording begins automatically
3. TTS plays recommendations - audio captured in video
4. Respond verbally - your voice captured in video
5. Complete session - video uploads with both audio tracks

## 🧊 Customer Emotional States System (Updated 2025-10-15)

### Five Emotion Levels (Redesigned)

#### 👤 **Normal Customer** (Replaced "Sunshine" - 2025-10-20)
- **Personality**: Everyday customer with reasonable expectations - respectful but has boundaries
- **Speech**: "Thank you", "Could you help me with...", "I need to speak with a manager" (if disrespected)
- **Behavior**: Conditionally cooperative - responds to how they're treated, will escalate if rude/dismissive
- **Use**: Realistic baseline training, teaches consequences of poor service, represents 80%+ of customers
- **Training Value**: Shows employees that respect must be maintained through professional behavior

#### 🧊 **Cold Customer** ⭐ NEW
- **Personality**: Neutral, skeptical urban customer - ironical but cooperative if reasonable
- **Speech**: "Mm.", "Sure.", "Whatever.", "*That's* interesting." (sarcastic), "Really?"
- **Behavior**: Emotionally reserved, tests authenticity, dismisses fake enthusiasm
- **Use**: Reading subtle cues, staying professional with skeptics, earning trust through competence
- **Training Focus**: Not over-selling, handling sarcasm, authenticity over charm

#### ⏱️ **In a Hurry** (Renamed from "Frustrated")
- **Personality**: Time-pressured customer needing quick, efficient service
- **Speech**: "Come on", "I'm in a hurry", "Seriously?", "Just...", "Finally"
- **Behavior**: Shorter responses, shows impatience, softens with quick service
- **Use**: Efficiency training, time management under pressure, urgency recognition

#### 😠 **Angry Customer**
- **Personality**: Very upset, demanding customer who's hard to please
- **Speech**: Uses CAPS for emphasis "This is UNACCEPTABLE!!!", challenges explanations
- **Use**: De-escalation basics, conflict resolution, empathy + action plan delivery

#### 🤬 **Extremely Angry Customer** ⚠️ ADVANCED
- **Personality**: Furious, confrontational customer refusing simple solutions
- **Speech**: HEAVY CAPS everywhere, multiple exclamation marks!!!, threatens consequences
- **Use**: Advanced de-escalation mastery, stress management, exceptional empathy

### Technical Implementation

**Complete Data Flow**:
```
Database (customer_emotion_level) → Training Page → ElevenLabsAvatarSession →
elevenlabs-conversation.ts → ElevenLabs API → AI Agent Behavior
```

**Files Modified** (10 files):
- **NEW**: `src/lib/customer-emotions.ts` - Complete emotion definitions
- **UPDATED**: All scenario management components, APIs, and services

**Database Migration**:
⚠️ **MANUAL MIGRATION REQUIRED** - See `NORMAL_CUSTOMER_MIGRATION_2025-10-20.md`
```sql
-- Latest migration (2025-10-20): Sunshine → Normal
UPDATE scenarios SET customer_emotion_level = 'normal' WHERE customer_emotion_level = 'sunshine';

ALTER TABLE scenarios
DROP CONSTRAINT IF EXISTS scenarios_customer_emotion_level_check;

ALTER TABLE scenarios
ADD CONSTRAINT scenarios_customer_emotion_level_check
CHECK (customer_emotion_level IN ('normal', 'cold', 'in_a_hurry', 'angry', 'extremely_angry'));
```

### De-Escalation Progression ✅
- **Normal** 👤 → Becomes slightly warmer OR escalates to manager (depends on how they're treated)
- **Cold** 🧊 → Softens SLIGHTLY to "respectfully neutral" or "reluctantly amused" (if genuine/competent)
- **In a Hurry** ⏱️ → Becomes calmer and more pleasant (if quick service + acknowledgment)
- **Angry** → Cautiously Cooperative (if empathy + action + effort)
- **Extremely Angry** → Grudging Acceptance (if exceptional empathy + multiple solutions + accountability)

### Console Logs for Verification
```
😤 Customer emotion level: extremely_angry
🎯 Starting session with dynamic variables: {customer_emotion_level: 'extremely_angry'}
🎭 🤬 Extremely Angry Customer greeting for ru: "Это НЕПРИЕМЛЕМО!..."
📝 Created language-aware system prompt for service_practice mode
```

**Status**: ✅ **PRODUCTION READY & TESTED** - Working in live conversations

---

## ⏱️ Session Time Limit System (2025-10-12 AM)

### Feature Overview ✅
Configurable session time limits for Theory Q&A and Service Practice scenarios, replacing legacy "difficulty level" and "estimated duration" fields.

### Database Schema
```sql
ALTER TABLE scenarios
ADD COLUMN IF NOT EXISTS session_time_limit_minutes INTEGER DEFAULT 10;
```

### TypeScript Interfaces
```typescript
export interface Scenario {
  session_time_limit_minutes?: number;  // 1-60 minutes
}
```

### Key Fixes During Implementation
1. **Auth State Caching**: Added localStorage caching with 5-minute TTL to prevent "Company ID Missing" errors
2. **Topic Display**: Fixed TopicTag component to use dynamic company_id instead of hardcoded "test"
3. **Complete Data Flow**: Field properly saved from form → API → database

### Files Modified
1. `src/components/ScenarioForm.tsx` - Added time limit field
2. `src/components/EditScenarioForm.tsx` - Added time limit field
3. `src/app/manager/page.tsx` - Display time limit in cards
4. `src/contexts/AuthContext.tsx` - Added localStorage caching
5. `src/lib/scenarios.ts` - Added field to interfaces
6. API routes updated for create/update operations

**Status**: ✅ **COMPLETE** with full CRUD functionality

---

## Future Improvements (Potential)
1. **Real-time Progress Dashboard** - Live mastery metrics for managers
2. **Learning Path Recommendations** - AI-suggested topics based on performance
3. **Spaced Repetition System** - Revisit mastered topics periodically
4. **Adaptive Difficulty** - Dynamic question difficulty adjustment
5. **Team Analytics** - Benchmark employee progress against team averages

---

## Historical Documentation
See **CLAUDE_ARCHIVE_2025.md** for:
- AI Knowledge Extraction System (2025-09-24)
- Manual Transcript Analysis System (2025-09-25)
- Language-Specific Initialization (2025-09-26)
- Scenario-Specific Question Selection (2025-09-29)
- Recommendation Training with Video Recording (2025-10-01)
