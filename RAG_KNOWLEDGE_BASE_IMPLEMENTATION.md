# RAG Knowledge Base Implementation Guide

**Status**: Implemented but DISABLED (2025-10-17)
**Current Approach**: Dynamic variables in system prompt
**Future Migration**: Per-company agents with RAG

---

## Table of Contents

1. [Why RAG is Disabled](#why-rag-is-disabled)
2. [Complete RAG Implementation](#complete-rag-implementation)
3. [Critical Fixes Discovered](#critical-fixes-discovered)
4. [When to Re-Enable RAG](#when-to-re-enable-rag)
5. [Migration Guide](#migration-guide)

---

## Why RAG is Disabled

### The Race Condition Problem

**Scenario**: Multiple companies using the same ElevenLabs agent concurrently

```
Timeline:
10:00:00 - Company A (Coffee Shop) starts session
         → PATCH /v1/convai/agents/{agentId}
         → Links Coffee Shop menu KB document
         → Agent globally configured with Coffee Shop menu ✅

10:00:05 - Company B (Restaurant) starts session
         → PATCH /v1/convai/agents/{agentId}
         → Links Restaurant menu KB document
         → Agent globally configured with Restaurant menu ✅

10:00:06 - Company A's session STILL RUNNING
         → But agent now has Restaurant menu! ❌
         → AI customer orders "pasta" instead of "cappuccino" ❌
```

**Root Cause**: `PATCH /v1/convai/agents/{agentId}` modifies the agent's **global configuration**, affecting:
- All future sessions ✅
- All currently active sessions ❌ ← **This causes the bug**

### Why Can't We Override KB Per Session?

**ElevenLabs session-level overrides support:**
- ✅ `agent.prompt` (system prompt)
- ✅ `agent.firstMessage`
- ✅ `agent.language`
- ✅ `tts.voiceId`
- ❌ `agent.prompt.knowledge_base` (NOT SUPPORTED)

**Our Solution**: Include company-specific menu data in system prompt override (via `knowledge_context` dynamic variable)

---

## Complete RAG Implementation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Service Practice Session Starts                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Load Knowledge from Database                            │
│     elevenLabsKnowledgeService.getScenarioKnowledge()      │
│     → Fetches menu items + company info                     │
│     → Returns formatted text (4.6 KB)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Search for Existing KB Document                         │
│     searchExistingDocument(documentName)                    │
│     → GET /v1/convai/knowledge-base?search={name}          │
│     → Returns existing document if found                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Create KB Document (if not found)                       │
│     createKnowledgeBaseDocument(text, name)                 │
│     → POST /v1/convai/knowledge-base/text                  │
│     → Returns {id, name}                                    │
│     → Triggers automatic RAG indexing (1-5 min)            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Link KB Document to Agent                               │
│     linkKnowledgeBaseToAgent(agentId, [document])          │
│     → PATCH /v1/convai/agents/{agentId}                    │
│     → Body: { conversation_config: {                        │
│         agent: { prompt: {                                  │
│           knowledge_base: [{                                │
│             type: "text",                                   │
│             id: "doc_id",                                   │
│             name: "doc_name",  ← REQUIRED!                 │
│             usage_mode: "auto"                              │
│           }],                                               │
│           rag: { enabled: true, ... }                       │
│         }}                                                  │
│       }}                                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Wait for RAG Indexing (automatic)                       │
│     Check: GET /v1/convai/knowledge-base/{id}/rag-index    │
│     Status: created → processing → succeeded ✅             │
│     Time: 1-5 minutes depending on document size            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Agent Ready to Retrieve Knowledge                       │
│     System prompt includes: # Tools: knowledge_base         │
│     Agent can now query indexed knowledge during convo      │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Fixes Discovered

### Fix #1: Missing `name` Field (CRITICAL)

**Problem**: ElevenLabs API returned 400 Bad Request with error:
```json
{
  "detail": {
    "status": "input_invalid",
    "message": "Field required: [\"agent\",\"prompt\",\"knowledge_base\",0,\"name\"]"
  }
}
```

**Solution**: Changed `linkKnowledgeBaseToAgent()` signature

```typescript
// BEFORE (BROKEN):
linkKnowledgeBaseToAgent(agentId: string, documentIds: string[])
const knowledgeBase = documentIds.map(id => ({
  type: 'text',
  id,
  usage_mode: 'auto',
}))

// AFTER (WORKING):
linkKnowledgeBaseToAgent(agentId: string, documents: KnowledgeBaseDocument[])
const knowledgeBase = documents.map(doc => ({
  type: 'text' as const,
  id: doc.id,
  name: doc.name,  // ← REQUIRED by ElevenLabs API
  usage_mode: 'auto' as const,
}))
```

**Files Modified**:
- `src/lib/elevenlabs-knowledge-sync.ts` (function signature + implementation)
- `src/app/api/elevenlabs-knowledge-sync/route.ts` (pass full documents)

---

### Fix #2: Duplicate Documents Prevention

**Problem**: In-memory cache doesn't persist across:
- Next.js hot reloads (development)
- Server restarts
- Serverless function instances (production)

Result: Every session attempt created a duplicate KB document

**Solution**: API-based deduplication

```typescript
async function searchExistingDocument(documentName: string): Promise<KnowledgeBaseDocument | null> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/knowledge-base?search=${encodeURIComponent(documentName)}&types=text`,
    { headers: { 'xi-api-key': apiKey } }
  )

  const data = await response.json()
  const matchingDoc = data.documents?.find((doc: any) => doc.name === documentName)

  return matchingDoc ? { id: matchingDoc.id, name: matchingDoc.name } : null
}

// Updated workflow:
export async function getOrCreateCompanyKnowledgeBase(...) {
  // 1. Check in-memory cache
  if (kbDocumentCache.has(cacheKey)) return cachedDoc

  // 2. Search ElevenLabs API
  const existingDoc = await searchExistingDocument(documentName)
  if (existingDoc) {
    kbDocumentCache.set(cacheKey, existingDoc)
    return existingDoc
  }

  // 3. Only create if not found
  const document = await createKnowledgeBaseDocument(...)
  return document
}
```

**Files Modified**:
- `src/lib/elevenlabs-knowledge-sync.ts` (added searchExistingDocument function)

---

### Fix #3: Tools Section in System Prompt

**Problem**: System prompt had `# Tools: None`, explicitly telling agent it has no knowledge base access

**Solution**: Changed to reference knowledge base tool

```typescript
// BEFORE (BROKEN):
# Tools

None

// AFTER (WORKING):
# Tools

\`knowledge_base\`: Contains the company menu and information. You have reviewed the menu before entering. When ordering, choose from the available menu items. Only order items that exist in the knowledge base.
```

**Files Modified**:
- `src/lib/elevenlabs-conversation.ts` (lines 292-294, 378-380)

---

### Fix #4: RAG Indexing is Automatic (but takes time)

**Discovery**:
- RAG indexing happens **automatically** when document is created
- Takes 1-5 minutes to complete
- Can check status: `GET /v1/convai/knowledge-base/{id}/rag-index`
- Status progression: `created` → `processing` → `succeeded`

**For Future**: If re-enabling RAG with polling:

```typescript
async function pollRAGIndexingStatus(documentId: string, maxWaitMs: number = 60000): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/knowledge-base/${documentId}/rag-index`,
      { headers: { 'xi-api-key': apiKey } }
    )

    const data = await response.json()
    const status = data.rag_indexes?.[0]?.status

    if (status === 'succeeded') {
      console.log(`✅ RAG indexing completed for ${documentId}`)
      return true
    }

    if (status === 'failed' || status === 'rag_limit_exceeded') {
      throw new Error(`RAG indexing failed: ${status}`)
    }

    await new Promise(resolve => setTimeout(resolve, 2000)) // Poll every 2 seconds
  }

  throw new Error('RAG indexing timed out')
}
```

---

### Fix #5: ElevenLabs Recommendation for Small KB

**From ElevenLabs Dashboard**:
> "Your knowledge base is small enough to be included directly in the prompt for faster responses. We don't recommend RAG for small knowledge bases."

**Threshold**: ~5-10 KB

**Benefits of Direct Inclusion**:
- ✅ No indexing delay
- ✅ No API calls needed
- ✅ Faster responses
- ✅ Simpler implementation

**Our menu**: 4.6 KB → Perfect for direct inclusion!

---

## When to Re-Enable RAG

### Criteria for Switching Back to RAG:

1. **Multiple Companies** (10+)
   - Need to isolate configurations per company
   - Implement per-company agent IDs

2. **Large Knowledge Bases** (>20 KB)
   - Menu exceeds prompt size limits
   - Need efficient retrieval from large catalogs

3. **Advanced RAG Features**
   - Multi-document retrieval
   - Semantic search across knowledge
   - Usage analytics per document

4. **Token Cost Optimization**
   - Dynamic variables add tokens to every request
   - RAG retrieval is more token-efficient at scale

---

## Migration Guide

### Step 1: Add Per-Company Agent IDs

**Database Migration**:
```sql
ALTER TABLE companies
ADD COLUMN elevenlabs_agent_id TEXT;

-- Optional: Add index for faster lookups
CREATE INDEX idx_companies_elevenlabs_agent_id
ON companies(elevenlabs_agent_id);
```

**Update TypeScript Interfaces**:
```typescript
// src/lib/companies.ts
export interface Company {
  id: string
  name: string
  elevenlabs_agent_id?: string  // NEW
  // ... other fields
}
```

---

### Step 2: Agent Cloning Workflow

**Option A: Manual (Dashboard)**
1. Go to ElevenLabs Dashboard
2. Clone your base agent for each company
3. Copy agent ID and store in `companies.elevenlabs_agent_id`

**Option B: Automated (API)**

```typescript
// src/lib/elevenlabs-agents.ts
export async function cloneAgentForCompany(
  baseAgentId: string,
  companyId: string,
  companyName: string
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  // Clone agent
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${baseAgentId}/clone`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Training Agent - ${companyName}`,
      }),
    }
  )

  const newAgent = await response.json()

  // Update database
  await supabaseAdmin
    .from('companies')
    .update({ elevenlabs_agent_id: newAgent.agent_id })
    .eq('id', companyId)

  return newAgent.agent_id
}

// Run migration for all existing companies:
async function migrateAllCompanies() {
  const { data: companies } = await supabaseAdmin
    .from('companies')
    .select('id, name')
    .is('elevenlabs_agent_id', null)

  for (const company of companies) {
    const agentId = await cloneAgentForCompany(
      'agent_9301k5efjt1sf81vhzc3pjmw0fy9', // Base agent
      company.id,
      company.name
    )
    console.log(`✅ Created agent ${agentId} for ${company.name}`)
  }
}
```

---

### Step 3: Update Training Page to Fetch Company Agent

**File**: `src/app/employee/training/[assignmentId]/page.tsx`

```typescript
// BEFORE (hardcoded):
<ElevenLabsAvatarSession
  agentId="agent_9301k5efjt1sf81vhzc3pjmw0fy9"
  // ...
/>

// AFTER (company-specific):
const companyAgentId = await fetchCompanyAgentId(user.company_id)

<ElevenLabsAvatarSession
  agentId={companyAgentId}
  // ...
/>
```

---

### Step 4: Enable RAG Feature Flag

**File**: `src/components/ElevenLabsAvatarSession.tsx`

```typescript
// Line 340: Change feature flag
const USE_RAG_KNOWLEDGE_BASE = true  // ← Enable RAG
```

**Result**:
- Each company has dedicated agent
- KB documents linked to company-specific agents
- No race conditions (agents are isolated)
- RAG retrieval works properly

---

### Step 5: Remove Dynamic Variables KB Inclusion

**Optional cleanup** (only if fully migrated to RAG):

```typescript
// src/components/ElevenLabsAvatarSession.tsx
const dynamicVariables = {
  // ... other fields

  // Remove knowledge_context for Service Practice (kept for Theory)
  ...(trainingMode === 'theory' && {
    knowledge_context: contextToUse?.formattedContext || ...
  }),
}
```

---

## Testing RAG After Migration

### Test Checklist:

1. ✅ **Agent Isolation**: Start sessions for 2 different companies simultaneously
   - Verify each agent has correct company's KB document
   - Verify no cross-contamination

2. ✅ **KB Document Reuse**: Start 3 sessions for same company
   - Should reuse existing KB document (no duplicates)
   - Check `searchExistingDocument()` logs

3. ✅ **RAG Indexing**: Create new company with new menu
   - Verify KB document gets created
   - Verify RAG indexing completes (check dashboard)
   - Verify agent can retrieve from indexed knowledge

4. ✅ **Agent Ordering Behavior**: Test Service Practice
   - Agent should only order items from company's actual menu
   - No invented items
   - Proper usage of knowledge base

---

## Files Reference

### Core Implementation Files (preserved in codebase):

1. **`src/lib/elevenlabs-knowledge-sync.ts`**
   - `searchExistingDocument()` - API-based deduplication
   - `createKnowledgeBaseDocument()` - Create KB document
   - `linkKnowledgeBaseToAgent()` - Link KB to agent with RAG config
   - `getOrCreateCompanyKnowledgeBase()` - Main orchestration
   - `checkKnowledgeBaseStatus()` - Check RAG indexing status

2. **`src/lib/elevenlabs-knowledge.ts`**
   - `getScenarioKnowledge()` - Load knowledge from database
   - `formatServiceContext()` - Format menu for KB

3. **`src/app/api/elevenlabs-knowledge-sync/route.ts`**
   - API endpoint that orchestrates KB sync

4. **`src/lib/elevenlabs-conversation.ts`**
   - System prompt formatting with Tools section

5. **`src/components/ElevenLabsAvatarSession.tsx`**
   - Feature flag (`USE_RAG_KNOWLEDGE_BASE`)
   - KB sync logic (lines 324-370)
   - Dynamic variables configuration

---

## Troubleshooting

### Issue: "No indexes" in ElevenLabs Dashboard

**Causes**:
1. Indexing hasn't completed yet (wait 1-5 minutes)
2. Document too small (<100 characters)
3. RAG quota exceeded (check subscription)

**Solution**: Check indexing status via API:
```bash
curl -X GET "https://api.elevenlabs.io/v1/convai/knowledge-base/{document_id}/rag-index" \
  -H "xi-api-key: YOUR_API_KEY"
```

---

### Issue: Agent Still Inventing Items

**Causes**:
1. System prompt missing `# Tools: knowledge_base` section
2. RAG indexing not completed
3. Agent not properly linked to KB document

**Debug Steps**:
```bash
# 1. Check agent configuration
curl -X GET "https://api.elevenlabs.io/v1/convai/agents/{agent_id}" \
  -H "xi-api-key: YOUR_API_KEY" | jq '.conversation_config.agent.prompt'

# 2. Verify KB is linked
# Should show knowledge_base array with your document

# 3. Check RAG status
curl -X GET "https://api.elevenlabs.io/v1/convai/knowledge-base/{document_id}/rag-index" \
  -H "xi-api-key: YOUR_API_KEY" | jq '.rag_indexes[0].status'

# Should show "succeeded"
```

---

### Issue: Duplicate KB Documents Created

**Cause**: Cache miss or API search not working

**Solution**: Check logs for:
```
🔍 Searching ElevenLabs API for existing document: "..."
📊 Search returned X documents
✅ Found existing document: { id: '...', name: '...' }
```

If search returns 0 documents but document exists:
- Check document name matches exactly
- Verify API key has read permissions
- Check ElevenLabs API status

---

## Summary

### What We Built:
- ✅ Complete RAG Knowledge Base integration
- ✅ API-based deduplication to prevent duplicates
- ✅ Proper KB document structure with required `name` field
- ✅ System prompt with Tools section
- ✅ Understanding of RAG indexing timing

### Why It's Disabled:
- ❌ Race conditions with shared agent across companies
- ✅ Dynamic variables work better for single-agent, multi-company setup
- ✅ Menu size (4.6 KB) fits well in dynamic variables

### When to Re-Enable:
- ✅ Implement per-company agents (add `elevenlabs_agent_id` to companies table)
- ✅ Menu size exceeds 20 KB
- ✅ Need advanced RAG features

### How to Re-Enable:
1. Run database migration (add agent ID column)
2. Clone agents for each company
3. Set `USE_RAG_KNOWLEDGE_BASE = true`
4. Test thoroughly with multiple concurrent sessions

---

**Documentation Created**: 2025-10-17
**Last Updated**: 2025-10-17
**Author**: Development team working on Hokku Training Sim
**Related Files**: See "Files Reference" section above
