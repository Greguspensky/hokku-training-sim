# Knowledge Base Final Implementation (Dynamic Variables Approach)

**Status**: ✅ **PRODUCTION READY** (2025-10-17)
**Approach**: Dynamic variables in system prompt
**Result**: AI customers only order real menu items from database

---

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Architecture](#architecture)
4. [Key Files](#key-files)
5. [Adding Menu Items](#adding-menu-items)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Migration History](#migration-history)

---

## Overview

### What This System Does

For **Service Practice** scenarios, the AI customer needs to order items from your company's menu. This system ensures the AI:
- ✅ Only orders items that exist in your database
- ✅ Can see the complete menu available
- ✅ Never invents fictional items (e.g., "эклер" when it doesn't exist)
- ✅ Works for multiple companies simultaneously without conflicts

### Current Implementation

**Menu items are sent directly in the system prompt** via dynamic variables. Each session gets an isolated copy of the menu.

---

## How It Works

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│  1. Session Starts                                  │
│     (User clicks "Start" in Service Practice)       │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  2. Load Knowledge from Database                    │
│     File: src/lib/elevenlabs-knowledge.ts          │
│     Function: getScenarioKnowledge()                │
│                                                      │
│     → Queries knowledge_base_documents table        │
│     → Filters by company_id                         │
│     → Gets documents with item_type='menu_item'     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  3. Format Menu Items                               │
│     Function: formatServiceContext()                │
│                                                      │
│     → Parses document content for item names        │
│     → Creates simple list:                          │
│       # Menu Items                                  │
│       Красный свитер                                │
│       Латте                                         │
│       Капучино                                      │
│       ...                                           │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  4. Include in Dynamic Variables                    │
│     File: src/components/ElevenLabsAvatarSession   │
│                                                      │
│     dynamicVariables = {                            │
│       knowledge_context: formattedMenu,             │
│       training_mode: 'service_practice',            │
│       ...                                           │
│     }                                               │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  5. Interpolate into System Prompt                  │
│     File: src/lib/elevenlabs-conversation.ts       │
│     Function: getLanguageAwareSystemPrompt()        │
│                                                      │
│     System prompt includes:                         │
│                                                      │
│     # Available Menu                                │
│                                                      │
│     ${dynamicVariables.knowledge_context}           │
│                                                      │
│     IMPORTANT: When ordering, MUST ONLY             │
│     choose items from menu above.                   │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  6. Send to ElevenLabs LLM                          │
│     Conversation.startSession({                     │
│       overrides: {                                  │
│         agent: {                                    │
│           prompt: {                                 │
│             prompt: systemPromptWithMenu            │
│           }                                         │
│         }                                           │
│       }                                             │
│     })                                              │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  7. AI Customer Orders Real Items                   │
│     LLM sees actual menu in prompt text             │
│     → Orders "Красный свитер" ✅                    │
│     → Orders "Латте" ✅                             │
│     → Does NOT order "эклер" (not in menu) ✅       │
└─────────────────────────────────────────────────────┘
```

---

## Architecture

### Database Schema

```sql
-- Knowledge base categories (e.g., "Menu Items", "Pastries", "Drinks")
CREATE TABLE knowledge_base_categories (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES companies(id),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Knowledge base documents (individual menu items, company info, etc.)
CREATE TABLE knowledge_base_documents (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES companies(id),
  category_id uuid REFERENCES knowledge_base_categories(id),
  title text NOT NULL,
  content text NOT NULL,
  item_type text CHECK (item_type IN ('menu_item', 'add_on', 'sop', 'info')),
  file_type text DEFAULT 'text',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Item Types

- **`menu_item`**: Menu items that customers can order (e.g., coffee drinks, pastries)
- **`add_on`**: Add-ons or modifications (e.g., extra shot, sugar, milk alternatives)
- **`sop`**: Standard Operating Procedures (internal, NOT sent to AI customer)
- **`info`**: Company information (history, philosophy - currently NOT included)

**Current Configuration**: Only `menu_item` documents are included in Service Practice sessions.

---

## Key Files

### 1. `src/lib/elevenlabs-knowledge.ts`

**Purpose**: Loads and formats knowledge from database

**Key Functions**:

```typescript
// Main entry point - loads knowledge for a scenario
async getScenarioKnowledge(
  scenarioId: string,
  companyId: string,
  maxChunks: number = 5
): Promise<ScenarioKnowledgeContext>

// Formats menu items for Service Practice
private formatServiceContext(
  chunks: KnowledgeChunk[],
  documents: KnowledgeBaseDocument[]
): string

// Parses individual menu item names from document content
private parseIndividualMenuItems(
  documents: KnowledgeBaseDocument[]
): string[]
```

**Current Behavior**:
- For Service Practice: Loads ALL company documents, prioritizes menu items
- Returns formatted string with menu item names only (no company info)
- Output example: `"# Menu Items\n\nКрасный свитер\nЛатте\n..."`

---

### 2. `src/components/ElevenLabsAvatarSession.tsx`

**Purpose**: Session initialization and knowledge loading

**Key Section** (Lines 324-370):

```typescript
// FEATURE FLAG: RAG Knowledge Base API (DISABLED)
const USE_RAG_KNOWLEDGE_BASE = false

if (USE_RAG_KNOWLEDGE_BASE && trainingMode === 'service_practice') {
  // RAG code disabled - see RAG_KNOWLEDGE_BASE_IMPLEMENTATION.md
}

// Create dynamic variables with knowledge context
const dynamicVariables = {
  training_mode: trainingMode,
  knowledge_context: contextToUse?.formattedContext ||
    'No specific company knowledge available.',
  knowledge_scope: contextToUse?.knowledgeScope || 'restricted',
  documents_available: contextToUse?.documents?.length || 0,
  // ... other variables
}
```

**Critical Change** (Line 367-369):
- **BEFORE**: `...(trainingMode === 'theory' && { knowledge_context: ... })`
- **AFTER**: `knowledge_context: ...` (included for ALL modes)

This ensures Service Practice sessions get menu data.

---

### 3. `src/lib/elevenlabs-conversation.ts`

**Purpose**: System prompt generation with menu interpolation

**Key Function**: `getLanguageAwareSystemPrompt()`

**Critical Section** (Lines 292-296 & 380-384):

```typescript
# Available Menu

${dynamicVariables?.knowledge_context || 'No menu information available.'}

IMPORTANT: When ordering, you MUST ONLY choose items from the menu above. DO NOT order items that are not listed.
```

**This is where the magic happens**: The `${dynamicVariables?.knowledge_context}` gets replaced with actual menu items, making them visible to the LLM.

**Previous (BROKEN) Approach**:
```typescript
# Tools

`knowledge_base`: Contains the company menu...
```
❌ This only TOLD the LLM about a knowledge base, but didn't show the actual menu.

---

### 4. `src/app/api/scenario-knowledge/route.ts`

**Purpose**: API endpoint for fetching knowledge

**Endpoint**: `POST /api/scenario-knowledge`

**Request Body**:
```json
{
  "scenarioId": "uuid",
  "companyId": "uuid",
  "maxChunks": 5
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "scenarioId": "uuid",
    "scenarioType": "service_practice",
    "documents": [...],
    "formattedContext": "# Menu Items\n\nКрасный свитер\n...",
    "knowledgeScope": "broad"
  }
}
```

---

## Adding Menu Items

### Option 1: Via Manager Dashboard (Recommended)

1. **Navigate to Manager Dashboard** → Knowledge Base section
2. **Create/Select Category** (e.g., "Menu Items", "Drinks", "Pastries")
3. **Add New Document**:
   - **Title**: Category name (e.g., "Coffee Drinks")
   - **Item Type**: Select `menu_item`
   - **Content**: List menu items (one per line or in structured format)

   Example content:
   ```
   Красный свитер
   Белый свитер
   Фейхоа пай
   Латте
   Капучино
   Эспрессо
   ```

4. **Save** → Items immediately available for next session

### Option 2: Direct Database Insert

```sql
-- Insert a menu item document
INSERT INTO knowledge_base_documents (
  id,
  company_id,
  category_id,
  title,
  content,
  item_type,
  file_type
) VALUES (
  gen_random_uuid(),
  'your-company-id',
  'your-category-id',
  'Coffee Drinks',
  'Латте
Капучино
Американо
Эспрессо',
  'menu_item',
  'text'
);
```

### Content Parsing Logic

The system parses menu items from document content using `parseIndividualMenuItems()`:

**Parsing Rules**:
- Extracts lines that look like menu items
- Skips section headers (lines starting with `#`)
- Skips description lines (lines starting with "Состав:", "Приготовление:", etc.)
- Matches patterns: `"Item Name"` or `"Item Name (size info)"`

**Example Document Content**:
```
# Кофейные напитки

Латте (350 мл)
Капучино (250 мл)
Эспрессо (30 мл)

Состав: эспрессо + молоко  ← Skipped (description line)
```

**Extracted Items**:
```
Латте
Капучино
Эспрессо
```

---

## Testing

### Manual Testing Steps

1. **Prepare Test Menu**:
   - Ensure your company has menu items in the database
   - Verify via API: `GET /api/knowledge-base/documents?company_id={id}`

2. **Start Service Practice Session**:
   - Navigate to Training page
   - Select Service Practice scenario
   - Click "Start Session"

3. **Check Browser Console**:
   ```
   ✅ Knowledge context loaded: 5 documents
   📝 Context preview: # Menu Items

Красный свитер
Латте
...

   - knowledge_context: ✅ Included (570 chars)

   # Available Menu

   # Menu Items
   Красный свитер
   Латте
   ...
   ```

4. **Test AI Ordering**:
   - Let AI customer order items
   - **Expected**: Only orders items from menu
   - **Fail Case**: Orders items not in menu (e.g., "эклер" when not present)

5. **Verify Transcript**:
   - End session
   - Check conversation transcript
   - Confirm all ordered items exist in menu

### Automated Testing

**API Test**:
```bash
curl -X POST http://localhost:3000/api/scenario-knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "scenarioId": "your-scenario-id",
    "companyId": "your-company-id",
    "maxChunks": 5
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "formattedContext": "# Menu Items\n\nКрасный свитер\nЛатте\n...",
    "documents": [...]
  }
}
```

---

## Troubleshooting

### Issue: AI Still Invents Items

**Symptoms**: Agent orders items not in menu (e.g., "эклер")

**Diagnosis**:
1. Check browser console for: `- knowledge_context: ✅ Included (X chars)`
2. Verify `X` is > 0 (should be ~500-1000 for typical menu)
3. Check system prompt preview in console - should show actual menu items

**Possible Causes**:

**A) No Menu Items in Database**
```bash
# Check database
curl "http://localhost:3000/api/knowledge-base/documents?company_id={id}"

# Should return documents with item_type='menu_item'
```

**Fix**: Add menu items to database (see "Adding Menu Items" section)

**B) Wrong Company ID**
```javascript
// Check console logs
console.log('company_id:', companyId)

// Verify this matches your database
```

**Fix**: Ensure correct company_id is passed to session

**C) Knowledge Context Not in Prompt**

Check `src/lib/elevenlabs-conversation.ts` line ~292:
```typescript
# Available Menu

${dynamicVariables?.knowledge_context || 'No menu information available.'}
```

**Fix**: Ensure interpolation syntax is correct (template literals)

---

### Issue: Empty Knowledge Context

**Symptoms**: Console shows `knowledge_context: ❌ NOT included` or `0 chars`

**Diagnosis**:
```bash
# Test API directly
curl -X POST http://localhost:3000/api/scenario-knowledge \
  -H "Content-Type: application/json" \
  -d '{"scenarioId":"...","companyId":"...","maxChunks":5}'
```

**Possible Causes**:

**A) No Documents Found**
```json
{
  "success": true,
  "data": {
    "documents": [],  // ← Empty!
    "formattedContext": "No menu items available."
  }
}
```

**Fix**: Add menu items to knowledge base

**B) Wrong Item Type**

Documents exist but have `item_type='sop'` or `item_type='info'` instead of `'menu_item'`.

**Fix**: Update item_type in database:
```sql
UPDATE knowledge_base_documents
SET item_type = 'menu_item'
WHERE company_id = 'your-id'
  AND (title LIKE '%Menu%' OR title LIKE '%Drink%' OR title LIKE '%Coffee%');
```

---

### Issue: Menu Too Long / Token Limit

**Symptoms**: System prompt exceeds token limits

**Current Size**: ~5,500 characters (well within limits)
**Token Limit**: ~8,000 tokens (~32,000 characters)

**If you exceed limits**:

**Option 1: Limit Document Count**
```typescript
// In src/lib/elevenlabs-knowledge.ts
.slice(0, 8) // Change to .slice(0, 5)
```

**Option 2: Abbreviate Menu Items**
```typescript
// In parseIndividualMenuItems()
return menuItemNames.slice(0, 50) // Limit to 50 items
```

**Option 3: Switch to RAG** (see `RAG_KNOWLEDGE_BASE_IMPLEMENTATION.md`)

---

## Migration History

### Timeline

**October 16, 2025**: Initial RAG Implementation
- Used ElevenLabs Knowledge Base API
- Discovered RAG indexing takes 1-5 minutes
- Fixed missing `name` field requirement
- Added API-based deduplication

**October 17, 2025**: Switched to Dynamic Variables
- **Reason**: Multi-company race conditions with shared agent
- **Benefit**: Per-session isolation, immediate availability
- **Result**: ✅ Production ready

### Why Dynamic Variables Instead of RAG?

**Pros of Dynamic Variables**:
- ✅ **No race conditions**: Each session isolated
- ✅ **No indexing delay**: Menu available immediately
- ✅ **Simpler architecture**: No KB API calls needed
- ✅ **ElevenLabs recommendation**: For small KB (<10 KB)
- ✅ **Works with shared agent**: Multiple companies, one agent

**Cons**:
- ⚠️ **Token usage**: Menu included in every request
- ⚠️ **Size limit**: ~20 KB max (our menu: 570 chars ✅)

**When to use RAG instead**:
- Menu exceeds 20 KB
- Need to support 100+ companies
- Implement per-company agents (see migration guide)

### RAG Implementation (Preserved)

Complete RAG implementation is preserved in code but disabled:

**Feature Flag** (Line 340 in `ElevenLabsAvatarSession.tsx`):
```typescript
const USE_RAG_KNOWLEDGE_BASE = false  // Set to true to enable
```

**Documentation**: See `RAG_KNOWLEDGE_BASE_IMPLEMENTATION.md` for:
- Complete RAG architecture
- All fixes discovered (name field, deduplication, indexing)
- Migration guide for per-company agents
- Step-by-step re-enablement instructions

---

## Summary

### Current State ✅

- **Approach**: Dynamic variables in system prompt
- **Status**: Production ready
- **Performance**: Menu loads instantly, no indexing delay
- **Compatibility**: Works for multiple companies simultaneously
- **Size**: 570 characters (well within limits)

### Key Success Factors

1. ✅ Menu items stored in `knowledge_base_documents` table
2. ✅ Loaded via `elevenLabsKnowledgeService.getScenarioKnowledge()`
3. ✅ Formatted with `formatServiceContext()` (menu items only)
4. ✅ Included in `dynamicVariables.knowledge_context`
5. ✅ **Interpolated into system prompt text** (critical!)
6. ✅ LLM can see actual menu items in prompt

### Files Modified from Default

1. `src/lib/elevenlabs-knowledge.ts` - Removed company info from Service Practice
2. `src/components/ElevenLabsAvatarSession.tsx` - Included knowledge_context for all modes
3. `src/lib/elevenlabs-conversation.ts` - Replaced tool reference with actual menu

---

**Documentation Created**: 2025-10-17
**Last Updated**: 2025-10-17
**Status**: ✅ Working in Production
**Next Review**: When menu size exceeds 10 KB or 100+ companies
