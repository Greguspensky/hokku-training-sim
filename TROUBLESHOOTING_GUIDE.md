# Troubleshooting Guide
**Hokku Training Simulation**

## 🚨 Quick Diagnostics

### 1. Check System Status
```bash
# Test environment configuration
curl http://localhost:3000/api/test-env

# Test ElevenLabs integration
curl "http://localhost:3000/api/elevenlabs-token?agentId=agent_5101k5ksv08newj9b4aa2wt282hv"

# Test knowledge loading
curl -X POST http://localhost:3000/api/scenario-knowledge \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "demo-scenario-1", "company_id": "01f773e2-1027-490e-8d36-279136700bbf"}'
```

### 2. Check Development Server
```bash
cd /Users/gregoryuspensky/hokku-training-sim/hokku-training-sim
npm run dev
```

Expected output:
```
✓ Ready in 1268ms
- Local: http://localhost:3000
🔑 Generating conversation token for agent: agent_5101k5ksv08newj9b4aa2wt282hv
✅ ElevenLabs conversation token generated successfully
```

---

## ❌ Common Issues & Solutions

### 1. ElevenLabs API Errors

#### Problem: 401 Unauthorized Error
```
❌ ElevenLabs token request failed: 401
{"detail":{"status":"missing_permissions","message":"The API key you used is missing the permission convai_write to execute this operation."}}
```

**Root Cause**: ElevenLabs API key lacks required permissions

**Solution**:
1. Log into ElevenLabs dashboard
2. Navigate to API keys section
3. Ensure key has `convai_write` permission
4. Update `.env.local` with correct key:
   ```bash
   ELEVENLABS_API_KEY=sk_your_key_with_convai_write_permissions
   ```
5. Restart dev server

#### Problem: 405 Method Not Allowed
```
❌ ElevenLabs token request failed: 405 {"detail":"Method Not Allowed"}
```

**Root Cause**: Using wrong HTTP method for token endpoint

**Solution**:
- Ensure using GET method: `GET /api/elevenlabs-token`
- Check API route implementation in `src/app/api/elevenlabs-token/route.ts`
- Verify endpoint supports GET requests only

### 2. Database Schema Issues

#### Problem: Missing Column Error
```
Error creating track in database: {
  "code": "PGRST204",
  "message": "Could not find the 'avatar_mode' column of 'tracks' in the schema cache"
}
```

**Root Cause**: Database schema missing required columns

**Solution**:
```sql
-- Connect to Supabase and run:
ALTER TABLE tracks ADD COLUMN avatar_mode TEXT DEFAULT 'text';

-- Or run existing fix file:
-- Check project root for: add-avatar-support.sql, fix-tracks-schema.sql
```

#### Problem: Foreign Key Constraint Violations
```
Error creating scenario in database: {
  "code": "23503",
  "message": "insert or update on table \"scenarios\" violates foreign key constraint \"scenarios_track_id_fkey\""
}
```

**Root Cause**: Orphaned scenarios referencing deleted tracks

**Solution**:
```sql
-- Clean up orphaned scenarios
DELETE FROM scenarios WHERE track_id NOT IN (SELECT id FROM tracks);

-- Check for other FK issues
SELECT * FROM scenarios s
LEFT JOIN tracks t ON s.track_id = t.id
WHERE t.id IS NULL;
```

### 3. Knowledge Loading Issues

#### Problem: Invalid UUID Format Warnings
```
⚠️ Invalid UUID format for scenario ID, assuming demo scenario: demo-scenario-1
🧪 Created mock scenario for demo: demo-scenario-1
```

**Root Cause**: Demo scenarios use string IDs instead of UUIDs

**Solution**: This is expected behavior in demo mode. For production:
1. Ensure all scenario IDs are valid UUIDs
2. Update demo data generation to use UUIDs
3. Or handle string IDs gracefully in code

#### Problem: No Knowledge Found
```
⚠️ No assigned knowledge found, loading sample company documents
```

**Root Cause**: Scenario-knowledge assignments missing

**Solution**:
```sql
-- Check scenario_knowledge table
SELECT * FROM scenario_knowledge WHERE scenario_id = 'your-scenario-id';

-- Create knowledge assignments if missing
INSERT INTO scenario_knowledge (scenario_id, document_id)
VALUES ('scenario-uuid', 'document-uuid');
```

### 4. Multiple Development Servers

#### Problem: Port Conflicts
```
⚠ Port 3000 is in use by process 10400, using available port 3001 instead.
```

**Root Cause**: Multiple `npm run dev` processes running

**Solution**:
```bash
# Find and kill existing processes
lsof -i :3000
kill -9 <PID>

# Or kill all node processes (use with caution)
pkill -f "next dev"

# Clean restart
npm run dev
```

### 5. Authentication Issues

#### Problem: Auth Loading Stuck
```
Employee page - authLoading: true user: false email: undefined
Employee page - showing auth loading
```

**Root Cause**: Supabase authentication not configured or session expired

**Solution**:
1. Check `.env.local` for correct Supabase keys
2. Clear browser cookies/localStorage
3. Test authentication:
   ```bash
   # Visit signin page
   open http://localhost:3000/signin

   # Or check auth status
   curl http://localhost:3000/api/debug-role
   ```

---

## 🔧 Advanced Diagnostics

### Database Connection Testing

#### Test Supabase Connection
```javascript
// Run in browser console or create test file
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://tscjbpdorbxmbxcqyiri.supabase.co',
  'your_anon_key_here'
)

// Test connection
supabase.from('users').select('count(*)')
  .then(console.log)
  .catch(console.error)
```

#### Check Row Level Security
```sql
-- In Supabase SQL editor
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check policies
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

### ElevenLabs Integration Testing

#### Test Agent Configuration
1. Visit ElevenLabs dashboard
2. Navigate to agent `agent_5101k5ksv08newj9b4aa2wt282hv`
3. Verify system prompt contains:
   ```
   {{examiner_instructions}}
   Use this knowledge base: {{knowledge_context}}
   Training mode: {{training_mode}}
   ```

#### Test Dynamic Variables
```bash
# Test variable generation
curl -X POST http://localhost:3000/api/test-knowledge-variables \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "demo-scenario-1"}'
```

### Performance Diagnostics

#### Monitor API Response Times
From logs, current performance:
- `GET /api/elevenlabs-token`: 655-1011ms
- `POST /api/scenario-knowledge`: 485-691ms
- `GET /api/track-assignments`: 442-693ms

#### Database Query Performance
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public';
```

---

## 🚑 Emergency Fixes

### Complete System Reset

#### 1. Clean Development Environment
```bash
# Stop all processes
pkill -f "next dev"
pkill -f node

# Clear build cache
rm -rf .next
rm -rf node_modules
npm install

# Restart
npm run dev
```

#### 2. Reset Database to Known State
```bash
# Backup current state
npm run db:backup

# Apply base schema
# Run supabase-schema.sql in Supabase SQL editor

# Apply required fixes
# Run fix-tracks-schema.sql
# Run add-avatar-support.sql
```

#### 3. Verify Core Functionality
```bash
# Test each system component
curl http://localhost:3000/api/test-env
curl http://localhost:3000/api/elevenlabs-token?agentId=agent_5101k5ksv08newj9b4aa2wt282hv
curl -X POST http://localhost:3000/api/scenario-knowledge -d '{"scenario_id":"demo-scenario-1","company_id":"01f773e2-1027-490e-8d36-279136700bbf"}' -H "Content-Type: application/json"
```

### Rollback Procedures

#### Database Rollback
```bash
# List available backups
npm run db:list-backups

# Restore specific backup
npm run db:restore backup-2025-09-24.sql
```

#### Code Rollback
```bash
# Check git status
git status
git log --oneline -10

# Rollback to previous commit if needed
git reset --hard HEAD~1
```

---

## 📊 Monitoring & Logging

### Current Log Patterns

#### Success Patterns
```
✅ ElevenLabs conversation token generated successfully
📄 Loaded 2 documents for theory scenario
📝 Formatted context length: 1629 characters
🔍 DEBUG: Found demo assignment in file: YES
```

#### Warning Patterns
```
⚠️ Invalid UUID format for scenario ID, assuming demo scenario
⚠️ No assigned knowledge found, loading sample company documents
⚠ Port 3000 is in use by process, using available port 3001
```

#### Error Patterns
```
❌ ElevenLabs token request failed: 401
❌ Failed to load scenario knowledge: Error
Error creating track in database: Could not find column
```

### Enable Debug Logging
```bash
# In .env.local, add:
DEBUG=1
NODE_ENV=development

# Restart server
npm run dev
```

---

## 🔍 Specific Error Solutions

### Error: "Cannot find module for page"
```
⨯ Failed to generate static paths for /api/track-assignments/[assignmentId]:
[Error [PageNotFoundError]: Cannot find module for page: /api/track-assignments/[assignmentId]/route]
```

**Solution**: File system issue with dynamic routes
1. Check file exists: `src/app/api/track-assignments/[assignmentId]/route.ts`
2. Restart dev server
3. Clear `.next` cache if needed

### Error: Session Recording Issues
```
🔍 Checking recording data for session: 86ce9ea9-406a-4f59-90b7-9a286e99047a
❌ Session not found
```

**Solution**: Database schema mismatch
1. Run `supabase-recording-schema-update.sql`
2. Update training_sessions table structure
3. Verify recording columns exist

### Error: Translation API Issues
**Check OpenAI API key configuration**:
```bash
# Test OpenAI connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## 📞 Support Resources

### Documentation Files
- `PROJECT_DOCUMENTATION.md` - Complete project overview
- `DATABASE_REFERENCE.md` - Database schema and issues
- `API_REFERENCE.md` - All API endpoints
- `CLAUDE.md` - Quick start and current status

### Key Configuration Files
- `.env.local` - Environment variables
- `package.json` - Dependencies and scripts
- `supabase-schema.sql` - Base database schema

### Test URLs
- Training Page: http://localhost:3000/employee/training/demo-assignment-1758312913428-7qtmmsq
- Test Environment: http://localhost:3000/api/test-env
- ElevenLabs Test: http://localhost:3000/test-elevenlabs

Remember: Most issues can be resolved by checking the logs, verifying environment variables, and ensuring the database schema is up to date.