# Hokku Training Sim - Development Session Log

## Project Overview
A Next.js 15 training simulation platform with Supabase backend for employee training management.

## Current Status (2025-09-19)
- ✅ **MAJOR MILESTONE**: ElevenLabs Conversational AI Integration Complete
- ✅ Theory Q&A Avatar Training System Operational
- ✅ Multi-language support with 13 languages (flags + names)
- ✅ Hard-coded knowledge base working (coffee shop menu in Russian)
- ✅ Agent behaves as strict theory examiner, asks progressive questions
- ✅ Employee management system fully operational
- ✅ Real database integration replacing hardcoded data
- ✅ Authentication system stable for managers and employees
- ✅ Auto-sync between Supabase Auth and users table

## Environment Setup
```bash
# Required Environment Variables (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://tscjbpdorbxmbxcqyiri.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY2picGRvcmJ4bWJ4Y3F5aXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNjQ2NjAsImV4cCI6MjA3Mjg0MDY2MH0.pjf_GMWVjuWibwSUGv3E2nuZ-asJ1q1nLU3T9xu0B-I
SUPABASE_SERVICE_ROLE_KEY=[CONFIGURED - bypasses RLS]
OPENAI_API_KEY=[CONFIGURED]

# Start Development Server
npm run dev  # Runs on port 3001 (3000 in use)
```

## Recent Major Fixes (Session: 2025-09-17)

### 1. Authentication System Overhaul
**Problem**: Infinite loading on sign-in for all users
**Solution**: Simplified AuthContext with email-based role detection
```typescript
// Key change in AuthContext.tsx
const isEmployeeUser = session.user.email?.includes('emp') || false
```
**Files Modified**: `src/contexts/AuthContext.tsx`

### 2. Employee Dashboard Crashes
**Problem**: React hooks order violations
**Solution**: Moved all useState hooks before conditional returns
**Files Modified**: `src/app/employee/page.tsx`

### 3. Manager Page Logout on Refresh
**Problem**: AuthContext loading state causing premature redirects
**Solution**: Added authLoading state check
**Files Modified**: `src/app/manager/employees/page.tsx`

### 4. Hardcoded Employee Data Issue
**Problem**: Employee list showed fake hardcoded data instead of real users
**Solution**:
- Removed hardcoded fallback employee list
- Added service role key for RLS bypass
- Created SQL sync script for auth.users → users table
**Files Modified**: `src/lib/employees.ts`, `src/lib/supabase.ts`

### 5. Auto-Sync Signup Process
**Problem**: New employees didn't appear until manual SQL script run
**Solution**: Modified signup API to auto-create users table records
**Files Modified**: `src/app/api/invite/signup/route.ts`

## Key Architecture Decisions

### Database Strategy
- **Supabase Auth**: Primary authentication system
- **users table**: Mirror of auth users for app queries (bypasses RLS with service role)
- **Auto-sync**: New signups automatically create users table records

### Role Detection
- **Email-based**: `email.includes('emp')` → employee, otherwise manager
- **Applied at**: Authentication, signup, and user creation

### RLS (Row Level Security)
- **Issue**: Anonymous key blocked by RLS policies
- **Solution**: Service role key bypasses RLS for employee queries
- **Implementation**: `supabaseAdmin` client in `src/lib/supabase.ts`

## Current User Base
```
Managers: greg@greg45.com, g3@greg.com
Employees: emp1@greg45.com through emp7@greg45.com (auto-synced)
```

## Testing URLs
- Manager Dashboard: http://localhost:3001/manager
- Employee Dashboard: http://localhost:3001/employee
- Employee Management: http://localhost:3001/manager/employees
- Sign In: http://localhost:3001/signin

## Known Working Features
- ✅ Manager/Employee authentication and routing
- ✅ Employee list displays real database users
- ✅ Employee invite system with auto-sync
- ✅ Page refresh without logout
- ✅ Real-time employee list updates

## SQL Scripts Created
- `sync-auth-users.sql` - Sync existing auth users to users table
- `create-user-function.sql` - RLS bypass function (not used)
- `create-track-assignments.sql` - Track assignment schema

## Next Session Priorities
1. Test employee dashboard functionality
2. Verify track assignment system
3. Test knowledge base features
4. Performance optimization if needed

## Development Notes
- **Port**: Using 3001 (3000 in use by another process)
- **Database**: All tables exist in Supabase
- **Authentication**: Stable and functional
- **Employee Management**: Production ready

## ElevenLabs Conversational AI Integration (Session: 2025-09-19)

### 🎯 Major Achievement: Working Theory Q&A System
**Problem**: Previous streaming conversation system was broken and complex
**Solution**: Replaced with ElevenLabs Conversational AI platform

### Key Components Implemented

#### 1. ElevenLabs Agent Configuration
- **Agent ID**: `agent_0201k5h7pzgve478dn5fnh21r35n`
- **System Prompt**: Configured in ElevenLabs dashboard with dynamic variable placeholders:
```
{{examiner_instructions}}

Use this knowledge base to ask questions:
{{knowledge_context}}

Training mode: {{training_mode}}
Available documents: {{documents_available}}

You are operating in {{training_mode}} mode. Follow the examiner instructions above strictly
```

#### 2. Hard-coded Knowledge Base (Coffee Shop)
**Location**: `src/components/ElevenLabsAvatarSession.tsx`
```javascript
const HARDCODED_KNOWLEDGE_BASE = `
COFFEE SHOP MENU AND PRICES:
НАПИТКИ (DRINKS): Эспрессо, Капучино, Латте, Раф...
БАЗОВАЯ ВЫПЕЧКА (PASTRIES): Паштель де ната, чизкейк сан себастьян...
`

const HARDCODED_EXAMINER_INSTRUCTIONS = `
You are a STRICT THEORY EXAMINER for a Russian coffee shop chain.
- After the student gives ANY answer, IMMEDIATELY move to the next question
- Do not repeat the same question - always ask different questions
- Ask questions about: drinks, sizes, pastries, ingredients
`
```

#### 3. Multi-Language Support
**File**: `src/app/employee/training/[assignmentId]/page.tsx`
- 13 supported languages with flags and names
- Language dropdown affects agent conversation language
- Real-time language switching
- Languages: EN🇺🇸, RU🇷🇺, DE🇩🇪, ES🇪🇸, FR🇫🇷, IT🇮🇹, and more

#### 4. Dynamic Variables System
**How it works**:
1. Client sends dynamic variables to ElevenLabs via SDK
2. ElevenLabs agent system prompt references variables with `{{variable_name}}`
3. Agent receives populated instructions and knowledge

```javascript
const dynamicVariables = {
  training_mode: "theory",
  knowledge_context: HARDCODED_KNOWLEDGE_BASE,
  examiner_instructions: HARDCODED_EXAMINER_INSTRUCTIONS,
  documents_available: 1,
  language: selectedLanguage
}
```

### Files Modified/Created
- `src/lib/elevenlabs-conversation.ts` - Conversation service with dynamic variables
- `src/components/ElevenLabsAvatarSession.tsx` - Hard-coded knowledge and instructions
- `src/app/employee/training/[assignmentId]/page.tsx` - Language selection UI
- `src/app/api/elevenlabs-token/route.ts` - Token API (GET method)

### Current Testing Status
✅ **Working**: Agent acts as theory examiner
✅ **Working**: Asks coffee shop specific questions ("What sizes for cappuccino?")
✅ **Working**: Moves to next question after any answer
✅ **Working**: Language selection affects agent responses
✅ **Working**: Debug panel shows all dynamic variables being sent

### Next Steps (if session continues)
1. **Dynamic Knowledge Loading** - Replace hard-coded knowledge with database
2. **Fix Knowledge Service** - Make `ElevenLabsKnowledgeService.getScenarioKnowledge()` work
3. **Question Evaluation** - Add scoring system for correct/incorrect answers
4. **Session Recording** - Save conversation transcripts to database

### Critical Success Factors Identified
1. **ElevenLabs Dashboard Configuration**: Must reference dynamic variables in system prompt
2. **Agent Behavior**: Clear instructions needed to prevent getting stuck on wrong answers
3. **Knowledge Format**: Russian coffee shop menu works well for specific questions
4. **Language Integration**: Seamless multi-language support via dropdown selection

## Last Updated
2025-09-19 - ElevenLabs Conversational AI integration complete