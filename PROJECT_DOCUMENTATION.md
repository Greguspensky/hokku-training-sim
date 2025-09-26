# Hokku Training Simulation - Project Documentation
**Last Updated: September 24, 2025**

## 🚀 Quick Start Guide

### Project Location
```
/Users/gregoryuspensky/hokku-training-sim/hokku-training-sim/
```

### Start Development
```bash
cd /Users/gregoryuspensky/hokku-training-sim/hokku-training-sim
npm run dev  # Starts on http://localhost:3000
```

### Key URLs
- **Training Page**: http://localhost:3000/employee/training/demo-assignment-1758312913428-7qtmmsq
- **Employee Dashboard**: http://localhost:3000/employee
- **Manager Dashboard**: http://localhost:3000/manager
- **Sign In**: http://localhost:3000/signin
- **ElevenLabs Test**: http://localhost:3000/test-elevenlabs

---

## 📊 Project Overview

**Hokku Training Sim** is a Next.js 15.5.2 application for employee training simulation using ElevenLabs Conversational AI. It features multilingual support, real-time voice interactions, and dynamic knowledge-based training scenarios.

### Tech Stack
- **Framework**: Next.js 15.5.2 with Turbopack
- **Database**: Supabase (PostgreSQL)
- **AI/Voice**: ElevenLabs Conversational AI
- **Translation**: OpenAI GPT + Google Translate
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS 4.0
- **Language**: TypeScript 5

### Core Features
- ✅ **ElevenLabs Integration**: Working conversational AI with dynamic variables
- ✅ **Multi-language Support**: 13 languages with flag selection
- ✅ **Theory Q&A Mode**: AI examiner asking knowledge-based questions
- ✅ **Demo Mode**: File-based assignments for testing
- ✅ **Knowledge Base**: Dynamic document loading system
- ⚠️ **Database Integration**: Partially working (some schema issues)

---

## 🏗️ Architecture

### Directory Structure
```
src/
├── app/
│   ├── api/                      # API routes
│   │   ├── elevenlabs-token/     # ElevenLabs authentication
│   │   ├── scenario-knowledge/   # Knowledge loading
│   │   ├── track-assignments/    # Training assignments
│   │   ├── knowledge-base/       # Document management
│   │   └── ...
│   ├── employee/                 # Employee interface
│   │   ├── training/[id]/        # Training sessions
│   │   ├── history/              # Session history
│   │   └── sessions/[id]/        # Session details
│   ├── manager/                  # Manager dashboard
│   └── signin/                   # Authentication
├── lib/                          # Core business logic
│   ├── elevenlabs-conversation.ts    # ElevenLabs integration
│   ├── elevenlabs-knowledge.ts       # Knowledge service
│   ├── scenarios.ts                  # Training scenarios
│   ├── track-assignments.ts          # Assignment management
│   ├── supabase.ts                   # Database client
│   └── ...
└── components/                   # React components
```

### Key Components
1. **ElevenLabs Integration** (`src/lib/elevenlabs-conversation.ts`)
2. **Knowledge Service** (`src/lib/elevenlabs-knowledge.ts`)
3. **Assignment Management** (`src/lib/track-assignments.ts`)
4. **Training Sessions** (`src/lib/training-sessions.ts`)

---

## 🔧 Current Status & Issues

### ✅ Working Features
- **ElevenLabs Conversational AI**: Fully functional with agent `agent_5101k5ksv08newj9b4aa2wt282hv`
- **Dynamic Variables**: System prompt receives `{{training_mode}}`, `{{knowledge_context}}`, etc.
- **Multi-language Support**: 13 languages with automatic translation
- **Demo Mode**: File-based assignments load successfully
- **Knowledge Loading**: 2 documents load from database (1629 characters)

### ⚠️ Current Issues

#### 1. Database Schema Issues
**Status**: Multiple schema problems identified
```
❌ Missing `avatar_mode` column in `tracks` table
❌ Foreign key constraint violations on scenarios
❌ Invalid UUID formats in demo scenarios
```

#### 2. Knowledge Service Issues
**Status**: Partially working but with warnings
```
⚠️ Invalid UUID format for scenario ID, assuming demo scenario
⚠️ No assigned knowledge found, loading sample company documents
```

#### 3. ElevenLabs API Issues (RESOLVED in newer versions)
**Previous Issues**:
- ❌ 405 Method Not Allowed (fixed)
- ❌ 401 missing permissions (API key updated)

### 🔍 Debug Information from Logs
```
🔍 DEBUG: Loaded assignments from file: 1 assignments
🔍 DEBUG: Assignment IDs loaded: ['demo-assignment-1758312913428-7qtmmsq']
📄 Loaded 2 documents for theory scenario
📝 Formatted context length: 1629 characters
✅ ElevenLabs conversation token generated successfully
```

---

## 🗄️ Database Schema

### Core Tables (from Supabase)
```sql
-- Companies
companies (
  id UUID PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMP
)

-- Users/Employees
users (
  id UUID PRIMARY KEY,
  email TEXT,
  name TEXT,
  role TEXT, -- 'employee', 'manager'
  company_id UUID REFERENCES companies(id)
)

-- Training Tracks
tracks (
  id UUID PRIMARY KEY,
  name TEXT,
  company_id UUID REFERENCES companies(id),
  -- avatar_mode MISSING - needs to be added
)

-- Knowledge Base
knowledge_base_documents (
  id UUID PRIMARY KEY,
  title TEXT,
  content TEXT,
  category_id UUID,
  company_id UUID REFERENCES companies(id)
)

-- Training Sessions
training_sessions (
  id UUID PRIMARY KEY,
  assignment_id UUID,
  employee_id UUID,
  recording_preference TEXT,
  audio_recording_url TEXT,
  video_recording_url TEXT,
  created_at TIMESTAMP
)

-- Track Assignments
track_assignments (
  id UUID PRIMARY KEY,
  employee_id UUID REFERENCES users(id),
  track_id UUID REFERENCES tracks(id),
  status TEXT,
  progress_percentage INTEGER
)
```

### Known Schema Issues
1. **Missing Columns**: `avatar_mode` in `tracks` table
2. **Foreign Key Issues**: Some scenarios reference non-existent tracks
3. **UUID Validation**: Demo scenarios use non-UUID identifiers

---

## 🌐 API Endpoints

### ElevenLabs Integration
- `GET /api/elevenlabs-token?agentId={id}` - Generate conversation token
- `POST /api/scenario-knowledge` - Load knowledge for scenario
- `GET /api/elevenlabs-conversation-audio/{id}` - Get audio files

### Training System
- `GET /api/track-assignments?employee_id={id}` - Get assignments
- `GET /api/track-assignments/{id}` - Get assignment details
- `POST /api/track-assignments/{id}/progress` - Update progress

### Knowledge Base
- `GET /api/knowledge-base/documents?company_id={id}` - Get documents
- `POST /api/knowledge-base/documents` - Create document
- `GET /api/knowledge-base/categories?company_id={id}` - Get categories

### Translation
- `POST /api/translate` - Translate content
- `POST /api/scenarios/{id}/translate` - Translate scenario

---

## 🔑 Environment Variables

### Current Configuration (.env.local)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tscjbpdorbxmbxcqyiri.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (for translation)
OPENAI_API_KEY=sk-proj-kwppSmyxsokW_S1TveE4P_uzG5KiCBQ2VAYiSM8y...

# ElevenLabs (with convai_write permissions)
ELEVENLABS_API_KEY=sk_441ad4e36eb9dc1602b38eb2537507c79e152b32...
```

### Required Permissions
- **ElevenLabs API Key**: Must have `convai_write` permission
- **Supabase**: Service role key for admin operations
- **OpenAI**: Standard API access for GPT-3.5/4

---

## 🧪 Testing & Demo Data

### Demo Company
```
Company ID: 01f773e2-1027-490e-8d36-279136700bbf
Employee ID: f68046c7-e78d-4793-909f-61a6f6587485
Assignment ID: demo-assignment-1758312913428-7qtmmsq
Track ID: 0fcafa44-eb6b-42e5-bcc3-7b89d224cfe7
```

### Demo Knowledge Base Content
**Russian Coffee Shop Menu**:
- **Drinks**: Эспрессо, Капучино (250/350/450 мл), Латте, Раф variants
- **Pastries**: Паштель де ната, чизкейк сан себастьян, various cakes

### Test API Endpoints
- `/api/test-env` - Environment check
- `/api/test-knowledge` - Knowledge loading test
- `/api/test-complete-flow` - Full system test
- `/api/test-session-start` - Session initialization test

---

## 🐛 Troubleshooting Guide

### Common Issues & Solutions

#### 1. ElevenLabs 401 Error
**Error**: `missing_permissions: convai_write`
**Solution**: Verify ElevenLabs API key has correct permissions

#### 2. Database Schema Errors
**Error**: `Could not find the 'avatar_mode' column`
**Solution**: Run schema update SQL files in project root

#### 3. Knowledge Loading Issues
**Error**: `Invalid UUID format for scenario ID`
**Solution**: Scenario uses demo ID, this is expected behavior

#### 4. Multiple Dev Servers
**Issue**: Multiple `npm run dev` processes running
**Solution**: Kill other processes or use different ports

### Debug Commands
```bash
# Check environment
curl http://localhost:3000/api/test-env

# Test knowledge loading
curl -X POST http://localhost:3000/api/scenario-knowledge \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "demo-scenario-1", "company_id": "01f773e2-1027-490e-8d36-279136700bbf"}'

# Test ElevenLabs token
curl http://localhost:3000/api/elevenlabs-token?agentId=agent_5101k5ksv08newj9b4aa2wt282hv
```

---

## 📝 Development Notes

### Package.json Scripts
```json
{
  "dev": "next dev --turbopack",
  "build": "next build --turbopack",
  "start": "next start",
  "lint": "eslint",
  "db:backup": "node scripts/backup-database.js",
  "db:restore": "node scripts/backup-database.js restore"
}
```

### Key Dependencies
- `@elevenlabs/client: ^0.6.2` - ElevenLabs integration
- `@supabase/supabase-js: ^2.57.4` - Database client
- `next: 15.5.2` - React framework
- `openai: ^5.20.3` - Translation service
- `react: 19.1.0` - UI library

### Development Workflow
1. Start with `npm run dev`
2. Access training page via demo assignment URL
3. Test ElevenLabs integration with theory mode
4. Monitor logs for database/API issues
5. Use test endpoints for debugging

---

## 🎯 Next Priority Tasks

### Immediate (High Priority)
1. **Fix Database Schema**: Add missing `avatar_mode` column
2. **Resolve UUID Issues**: Handle demo scenarios properly
3. **Clean up Dev Processes**: Consolidate multiple npm processes

### Short Term
1. **Dynamic Knowledge Loading**: Fix hard-coded knowledge base
2. **Question Scoring**: Add evaluation system
3. **Error Handling**: Improve API error responses

### Long Term
1. **Full Production Database**: Replace demo mode
2. **Advanced Training Modes**: Beyond theory Q&A
3. **Analytics Dashboard**: Training progress tracking

---

## 🔗 Important Files Reference

### Configuration Files
- `package.json` - Dependencies and scripts
- `.env.local` - Environment variables
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - TypeScript settings

### Core Business Logic
- `src/lib/elevenlabs-conversation.ts` - Main AI integration
- `src/lib/elevenlabs-knowledge.ts` - Knowledge service
- `src/lib/track-assignments.ts` - Assignment management
- `src/lib/scenarios.ts` - Training scenarios

### API Routes
- `src/app/api/elevenlabs-token/route.ts` - Authentication
- `src/app/api/scenario-knowledge/route.ts` - Knowledge loading
- `src/app/api/track-assignments/route.ts` - Assignment API

### Database Scripts
- Multiple `.sql` files in project root for schema updates
- `.js` files for database operations and testing

This documentation provides a complete overview of the project state and should enable quick onboarding for future development sessions.