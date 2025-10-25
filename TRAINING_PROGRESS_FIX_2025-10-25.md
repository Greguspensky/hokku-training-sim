# Training Progress Display Fix - October 25, 2025

## Overview

Fixed critical bugs preventing training progress from displaying correctly in both manager and employee views. The issues ranged from UI improvements to fundamental data query bugs.

---

## Issue #1: Service Practice AI Behavior (CRITICAL) ✅ FIXED

### Problem
AI customers in Service Practice scenarios were ignoring detailed behavioral instructions specified in `client_behavior` field and acting generically instead.

**Example**: Scenario instructed "you MUST get the receipt and can't leave without it", but AI immediately gave up when told "no" and suggested ordering coffee.

### Root Cause
The emotion-based system prompt (used for ALL scenarios with `customer_emotion_level` set) was missing the `client_behavior` field. It only included:
- Scenario title
- Generic emotion personality (e.g., "normal customer is polite")
- ❌ Missing: Specific behavioral requirements

### Affected Scenarios
ALL Service Practice scenarios with any emotion level:
- `normal` customer
- `cold` customer
- `in_a_hurry` customer
- `angry` customer
- `extremely_angry` customer

### Fix
**File**: `src/lib/elevenlabs-conversation.ts` (line 264)

Added `client_behavior` field between scenario title and emotion personality:

```typescript
# Personality
You are ${customerName}, a customer at a ${establishmentType}.

Situation: ${dynamicVariables?.scenario_title || 'You are visiting this establishment seeking service'}

${dynamicVariables?.client_behavior ? '\n' + dynamicVariables.client_behavior + '\n' : ''}  // ✅ ADDED

${emotionDefinition.personality}
```

**Impact**: AI now follows both emotion level (how to behave) AND scenario-specific requirements (what to do).

**Commit**: `0dee424`

---

## Issue #2: Custom First Messages Not Working ✅ FIXED

### Problem
Custom `first_message` fields stored in database weren't being sent to ElevenLabs AI, so scenarios started with generic greetings instead of custom opening lines.

**Example**:
- Database: `"AAA!!! Я умираю!"`
- Actual: Generic "Здравствуйте"

### Root Cause
Training page component wasn't including `first_message` in the `scenarioContext` object passed to `ElevenLabsAvatarSession`.

### Fix
**File**: `src/app/employee/training/[assignmentId]/page.tsx` (line 1461)

Added `first_message` to scenarioContext:

```typescript
scenarioContext={{
  title: currentScenario.title,
  description: currentScenario.description,
  type: currentScenario.scenario_type,
  client_behavior: currentScenario.client_behavior,
  expected_response: currentScenario.expected_response,
  customer_emotion_level: currentScenario.customer_emotion_level,
  first_message: currentScenario.first_message,  // ✅ ADDED
  milestones: currentScenario.milestones
}}
```

**Impact**: AI customers now start conversations with custom opening lines.

**Commit**: `0dee424`

---

## Issue #3: Transcript UI Improvements ✅ FIXED

### Problem
Session transcript page displayed plain alternating text with no visual distinction between AI customer and employee.

### Old Design
- Plain text alternating left/right by index (even/odd)
- No chat bubbles
- No color distinction
- Only latest message was black, others gray

### New Design
- Modern chat bubble interface (WhatsApp/iMessage style)
- Role-based alignment:
  - AI Customer (`role: 'assistant'`) → Gray bubble on left
  - Employee (`role: 'user'`) → Green bubble on right
- Rounded corners with proper padding
- Better spacing

### Fix
**File**: `src/app/employee/sessions/[sessionId]/page.tsx` (lines 786-809)

```typescript
// Before: Plain text
<p className={`text-sm leading-relaxed ${isLatest ? 'text-gray-900' : 'text-gray-500'}`}>
  {message.content}
</p>

// After: Chat bubbles
<div className={`max-w-[75%] rounded-lg px-4 py-3 ${
  isAssistant
    ? 'bg-gray-100 text-gray-900'  // AI customer: gray bubble on left
    : 'bg-green-100 text-gray-900'  // Employee: green bubble on right
}`}>
  <p className="text-sm leading-relaxed">
    {message.content}
  </p>
</div>
```

**Commit**: `0dee424`

---

## Issue #4: Progress Calculation Logic ✅ FIXED

### Problem
Training tracks showed **0% progress** until ALL questions were answered correctly (100% completion), even when employees had made significant progress.

**Example**:
- Employee answered 12/67 questions correctly = 18% actual progress
- Display showed: 0%

### Root Cause
`calculateRealProgress()` function used binary completion logic:
- Counted scenarios as "completed" only if `completionPercentage === 100`
- Otherwise counted as 0%
- Progress = (completed scenarios / total scenarios)

This meant partial progress was invisible until perfection.

### Fix
**File**: `src/components/Employee/TrainingTrackCard.tsx` (lines 187-201)

Changed from binary "completed count" to weighted average:

```typescript
// Before: Binary completion logic
let completedCount = 0
if (stats.completionPercentage === 100) {
  completedCount++
}
return (completedCount / scenarios.length) * 100

// After: Weighted average
let totalProgress = 0
totalProgress += stats.completionPercentage  // Use actual percentage
return totalProgress / scenarios.length
```

**Impact**: Progress now shows gradual improvement (18% instead of 0%).

**Commit**: `e3eefa0`

---

## Issue #5: Employee User ID Data Integrity ⚠️ DOCUMENTED

### Problem
Employees who registered/logged in have `user_id: null` in employees table, potentially breaking progress queries (though ultimately not the root cause).

### Affected Employees
As of 2025-10-25:
- Maria Vasileva (mvasileva@cam.cof) - ✅ FIXED manually
- Tima (tima@730.730) - ⚠️ Still null
- Test (test@cam.cof) - ⚠️ Still null
- Sergey Novikov (snovikov@cam.cof) - ⚠️ Still null
- Nikita Marin (nmarin@cam.cof) - ⚠️ Still null

### Fix Applied (Maria Only)
```sql
UPDATE employees
SET user_id = '58c1d351-0ee6-4137-9fff-b0ead7349dce'
WHERE id = '2686212e-f9f1-4aa2-b313-c3120fa3946d';
```

### Long-Term Fix Needed
1. Fix registration/login flow to set `user_id` when employee joins
2. Create backfill script for existing employees
3. Optional: Add database trigger to auto-sync

**Documentation**: `EMPLOYEE_USER_ID_FIX_2025-10-25.md`

**Commit**: `f67245f`

---

## Issue #6: Column Name Bug in Stats API (CRITICAL) ✅ FIXED

### Problem
Training track progress showed **0%** for ALL employees even when they had answered questions correctly. This was the REAL root cause of the entire issue.

### Root Cause
The `scenario-stats-batch` API was querying the wrong column:

```typescript
// WRONG (what the code had):
.eq('employee_id', userId)

// CORRECT (what the table actually uses):
.eq('user_id', userId)
```

The `question_attempts` table uses `user_id` column, not `employee_id`.

### Discovery Process
1. Suspected employee user_id linkage issue (partially true)
2. Added employee_id lookup logic (incorrect solution)
3. Created debug endpoint to inspect database structure
4. Found `question_attempts` uses `user_id` field directly:

```json
{
  "attemptsByEmployeeId": {"count": 0},  // No such column or no data
  "attemptsByUserId": {"count": 19}      // ✅ Found data here!
}
```

### Fix
**File**: `src/app/api/scenario-stats-batch/route.ts` (line 107)

**ONE LINE CHANGE**:

```typescript
const { data: correctAttempts } = await supabaseAdmin
  .from('question_attempts')
  .select('question_id')
  .eq('user_id', userId)  // ✅ FIXED: was 'employee_id'
  .in('question_id', Array.from(allQuestionIds))
  .eq('is_correct', true);
```

### Test Results
**Before**:
```json
{
  "success": true,
  "stats": {
    "66732f11-5796-4bb2-99e9-04bc62bd2188": {
      "completionPercentage": 0  // ❌ WRONG
    }
  }
}
```

**After**:
```json
{
  "success": true,
  "stats": {
    "66732f11-5796-4bb2-99e9-04bc62bd2188": {
      "completionPercentage": 18  // ✅ CORRECT (12/67 = 18%)
    }
  }
}
```

**Impact**: Training progress now displays correctly in BOTH manager and employee views. This was the actual bug preventing all progress display.

**Commit**: `88ebeae`

---

## Summary of All Fixes

| Issue | Severity | Status | Commit | Impact |
|-------|----------|--------|--------|--------|
| Service Practice AI ignoring behavior | 🔴 Critical | ✅ Fixed | `0dee424` | AI now follows scenario requirements |
| Custom first messages not working | 🟡 Medium | ✅ Fixed | `0dee424` | Custom opening lines work |
| Transcript UI plain text | 🟢 Low | ✅ Fixed | `0dee424` | Modern chat interface |
| Progress calculation binary | 🔴 Critical | ✅ Fixed | `e3eefa0` | Shows gradual progress |
| Employee user_id null | 🟡 Medium | ⚠️ Documented | `f67245f` | Maria fixed, 4 remain |
| Stats API column name | 🔴 CRITICAL | ✅ Fixed | `88ebeae` | **Root cause - fixed ALL progress display** |

---

## Testing Verification

### Before All Fixes
- Manager view: 0% progress for Maria
- Employee view: 0% progress
- Service Practice: AI acted generically
- Transcript: Hard to read

### After All Fixes
- Manager view: 18% progress for Maria ✅
- Employee view: 18% progress ✅
- Service Practice: AI follows scenario requirements ✅
- Transcript: Modern chat bubbles ✅

---

## Technical Notes

### Data Flow for Progress
1. Employee answers questions in Theory Q&A session
2. Answers stored in `question_attempts` table with `user_id`
3. Manager/Employee views → `TrainingTrackCard` component
4. Component calls `/api/scenario-stats-batch?user_id=...`
5. API queries `question_attempts` by `user_id` (was querying by `employee_id` ❌)
6. Returns `completionPercentage` per scenario
7. Component calculates weighted average across scenarios (was binary ❌)
8. Display shows progress percentage

### Why The Bug Was So Hidden
The `question_attempts` table schema was inconsistent with naming conventions:
- Most tables link employees via `employee_id`
- But `question_attempts` uses `user_id` (auth user ID directly)
- API code assumed it would be `employee_id` like other tables
- No error was thrown - query just returned 0 results
- Appeared as "no progress" rather than a crash

---

## Related Files

### Frontend Components
- `src/components/Employee/TrainingTrackCard.tsx` - Progress calculation
- `src/components/Manager/EmployeeDashboardView.tsx` - Manager view
- `src/app/employee/training/[assignmentId]/page.tsx` - Training session
- `src/app/employee/sessions/[sessionId]/page.tsx` - Transcript UI

### Backend APIs
- `src/app/api/scenario-stats-batch/route.ts` - **CRITICAL FIX HERE**
- `src/app/api/question-progress/route.ts` - Question-level progress
- `src/app/api/record-question-attempt/route.ts` - Records attempts

### Service Practice
- `src/lib/elevenlabs-conversation.ts` - System prompt generation
- `src/components/ElevenLabsAvatarSession.tsx` - Service Practice component

---

## Priority Actions

### Immediate
- ✅ All critical bugs fixed
- ✅ Progress displays correctly

### Short-Term
- ⚠️ Fix remaining 4 employees with null user_id
- ⚠️ Add monitoring/alerts for progress display issues

### Long-Term
- 🔲 Fix registration flow to set user_id automatically
- 🔲 Create backfill script for employee user_id
- 🔲 Add database constraints to prevent null user_id
- 🔲 Standardize column naming (user_id vs employee_id)

---

## Lessons Learned

1. **Always verify actual database schema** - Don't assume column names
2. **Create debug endpoints** - Invaluable for diagnosing data issues
3. **Test with real data** - Edge cases reveal hidden bugs
4. **One bug can mask another** - Progress calculation + column name were separate issues
5. **Module-level caching** - Dev server caches can hide fixes until restart

---

**Documented**: October 25, 2025
**Fixed By**: Claude Code
**Total Commits**: 3 main fixes + 1 documentation
**Lines Changed**: ~50 total (small changes, huge impact)

Co-Authored-By: Claude <noreply@anthropic.com>
