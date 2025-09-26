# Database Schema Reference
**Hokku Training Simulation**

## 🗄️ Current Database Status

### Connection Details
- **Provider**: Supabase (PostgreSQL)
- **URL**: https://tscjbpdorbxmbxcqyiri.supabase.co
- **Schema Files**: `supabase-schema.sql`, plus multiple update files

### Demo Data IDs
```
Company ID: 01f773e2-1027-490e-8d36-279136700bbf
Employee ID: f68046c7-e78d-4793-909f-61a6f6587485
Assignment ID: demo-assignment-1758312913428-7qtmmsq
Track ID: 0fcafa44-eb6b-42e5-bcc3-7b89d224cfe7
Agent ID: agent_5101k5ksv08newj9b4aa2wt282hv
```

## 📊 Core Tables

### Users & Authentication
```sql
-- Users (auth-based)
users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role in ('manager', 'employee')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- Companies
companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Company membership
company_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  role TEXT CHECK (role in ('owner', 'manager', 'employee')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id)
)
```

### Training System
```sql
-- Training tracks
tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  company_id UUID REFERENCES companies(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
  -- ❌ MISSING: avatar_mode column (schema issue)
)

-- Track assignments
track_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES users(id),
  track_id UUID REFERENCES tracks(id),
  assigned_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'assigned',
  progress_percentage INTEGER DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- Training scenarios
scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID REFERENCES tracks(id), -- ❌ FK constraint issues
  name JSONB NOT NULL,
  description JSONB,
  questions JSONB,
  type TEXT DEFAULT 'theory',
  created_at TIMESTAMPTZ DEFAULT now()
)
```

### Knowledge Base
```sql
-- Knowledge categories
knowledge_base_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Knowledge documents
knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES knowledge_base_categories(id),
  company_id UUID REFERENCES companies(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- Scenario knowledge assignments
scenario_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID REFERENCES scenarios(id),
  document_id UUID REFERENCES knowledge_base_documents(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scenario_id, document_id)
)
```

### Training Sessions & Recording
```sql
-- Training sessions
training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES track_assignments(id),
  employee_id UUID REFERENCES users(id),
  scenario_id UUID,
  recording_preference TEXT,
  recording_consent_timestamp TIMESTAMPTZ,
  audio_recording_url TEXT,
  video_recording_url TEXT,
  audio_file_size INTEGER,
  video_file_size INTEGER,
  recording_duration_seconds INTEGER,
  session_data JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- ElevenLabs conversations
elevenlabs_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_session_id UUID REFERENCES training_sessions(id),
  conversation_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

## ❌ Known Schema Issues

### 1. Missing Columns
```sql
-- tracks table missing avatar_mode column
-- Error: "Could not find the 'avatar_mode' column of 'tracks'"
-- Fix: ALTER TABLE tracks ADD COLUMN avatar_mode TEXT DEFAULT 'text';
```

### 2. Foreign Key Violations
```sql
-- scenarios.track_id references non-existent tracks
-- Error: "violates foreign key constraint scenarios_track_id_fkey"
-- Issue: Orphaned scenarios with invalid track_id references
```

### 3. Demo Data UUID Issues
```sql
-- Demo scenarios use string IDs instead of UUIDs
-- Warning: "Invalid UUID format for scenario ID"
-- Demo IDs: 'demo-assignment-1758312913428-7qtmmsq', 'demo-scenario-1'
-- These work but generate warnings in logs
```

## 🔧 Row Level Security (RLS) Policies

### Users Table
- Users can view/edit own profile only
- Auth-based access control

### Company Data
- Members can access company resources
- Role-based permissions (owner > manager > employee)

### Training Data
- Employees can access own assignments
- Managers can access team data
- Company isolation enforced

## 📊 Current Data Status

### Demo Company Data
From logs showing successful operations:
```
📄 Loaded 2 documents for theory scenario
📝 Formatted context length: 1629 characters
🔍 DEBUG: Found 1 active demo assignments for employee
📋 Total demo assignments in storage: 1
```

### Knowledge Base Content (Working)
- **Company**: Demo coffee shop (Russian)
- **Documents**: 2 active documents
- **Content**: Drinks & pastries menu (1629 chars)
- **Languages**: Multilingual support active

### Assignment System (Working)
- **Demo Assignment**: `demo-assignment-1758312913428-7qtmmsq`
- **Employee**: `f68046c7-e78d-4793-909f-61a6f6587485`
- **Track**: `0fcafa44-eb6b-42e5-bcc3-7b89d224cfe7`
- **Status**: Active, progress 0%

## 🔄 Database Operations

### Common Queries

#### Get Employee Assignments
```sql
SELECT ta.*, t.name as track_name
FROM track_assignments ta
JOIN tracks t ON ta.track_id = t.id
WHERE ta.employee_id = $1 AND ta.is_active = true;
```

#### Load Knowledge for Scenario
```sql
SELECT kd.*
FROM knowledge_base_documents kd
JOIN scenario_knowledge sk ON kd.id = sk.document_id
WHERE sk.scenario_id = $1;
```

#### Get Training Session Details
```sql
SELECT ts.*, ta.track_id, u.name as employee_name
FROM training_sessions ts
JOIN track_assignments ta ON ts.assignment_id = ta.id
JOIN users u ON ts.employee_id = u.id
WHERE ts.id = $1;
```

### Demo Data Files
- `.demo-data/demo-assignments.json` - File-based assignments
- Demo mode bypasses database for assignments
- Knowledge still loads from database

## 🚨 Priority Fixes Needed

### 1. Schema Updates (High Priority)
```sql
-- Add missing column
ALTER TABLE tracks ADD COLUMN avatar_mode TEXT DEFAULT 'text';

-- Clean up orphaned scenarios
DELETE FROM scenarios WHERE track_id NOT IN (SELECT id FROM tracks);

-- Add proper constraints
ALTER TABLE scenarios ADD CONSTRAINT valid_track_id
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE;
```

### 2. Data Integrity (Medium Priority)
- Verify all FK relationships
- Clean up orphaned records
- Ensure UUID consistency

### 3. Demo Mode Improvements (Low Priority)
- Handle non-UUID demo IDs gracefully
- Add demo data validation
- Improve warning messages

## 📝 Maintenance Notes

### Backup Commands
```bash
npm run db:backup        # Create backup
npm run db:restore      # Restore backup
npm run db:list-backups # List backups
```

### Schema Update Files
Multiple SQL files in project root:
- `supabase-schema.sql` - Base schema
- `add-avatar-support.sql` - Avatar features
- `fix-training-sessions.sql` - Session fixes
- `supabase-recording-schema-update.sql` - Recording schema

### Testing Database Connection
```bash
# Test API endpoints
curl http://localhost:3000/api/test-env
curl -X POST http://localhost:3000/api/scenario-knowledge
```

This database reference provides the complete schema status and known issues for the Hokku Training Simulation project.