# Normal Customer Emotion Migration (2025-10-20)

## Summary
Replaced "Sunshine Customer" with "Normal Customer" - a more realistic baseline customer type with boundaries.

## Database Migration Required

⚠️ **MANUAL MIGRATION REQUIRED** - Run these SQL commands in Supabase SQL Editor:

```sql
-- Step 1: Update existing 'sunshine' records to 'normal'
UPDATE scenarios
SET customer_emotion_level = 'normal'
WHERE customer_emotion_level = 'sunshine';

-- Step 2: Drop old constraint
ALTER TABLE scenarios
DROP CONSTRAINT IF EXISTS scenarios_customer_emotion_level_check;

-- Step 3: Add new constraint with updated values
ALTER TABLE scenarios
ADD CONSTRAINT scenarios_customer_emotion_level_check
CHECK (customer_emotion_level IN ('normal', 'cold', 'in_a_hurry', 'angry', 'extremely_angry'));
```

## Changes Made

### 1. Customer Emotion Definitions (`src/lib/customer-emotions.ts`)
- **Removed**: `sunshine` (overly positive, unrealistic baseline)
- **Added**: `normal` (realistic everyday customer with boundaries)

### 2. Key Differences

#### Sunshine Customer (OLD)
- ☀️ Unconditionally positive
- Forgives everything
- Never escalates
- Unrealistic training baseline

#### Normal Customer (NEW)
- 👤 Conditionally cooperative
- Responds to how they're treated
- Will escalate if disrespected
- Realistic training baseline

### 3. Normal Customer Specifications

**Personality**: Typical customer with reasonable expectations. Polite and respectful by default, but has clear boundaries. Won't tolerate rudeness or unprofessional behavior.

**Key Behaviors**:
- Polite but not overly enthusiastic
- Genuinely curious about products
- Appreciates competent service
- Will escalate if treated poorly
- Represents majority of real customers

**Escalation Triggers**:
- Rudeness or dismissive tone
- Condescending behavior
- Ignoring legitimate concerns
- Blaming customer for employee mistakes

### 4. Training Value

The "Normal Customer" provides better training because:
- Teaches employees that respect is earned through professional behavior
- Represents 80%+ of real-world customers
- Shows consequences of poor service (escalation)
- Creates realistic performance expectations
- Differentiates from "Cold Customer" (skeptical by nature) and "In a Hurry" (time-pressured)

## Files Modified

1. ✅ `src/lib/customer-emotions.ts` - Updated emotion type and definition
2. ✅ `src/lib/scenarios.ts` - Updated interfaces and default value
3. ✅ `src/app/employee/training/[assignmentId]/page.tsx` - Updated UI conditionals
4. ⚠️ Database constraint needs manual update

## Testing Checklist

- [ ] Run database migration in Supabase
- [ ] Create new scenario with "Normal Customer" emotion
- [ ] Verify AI behavior matches Normal Customer specs
- [ ] Test escalation trigger (be rude to customer)
- [ ] Verify UI shows correct icon (👤) and color (blue)
- [ ] Ensure old scenarios with 'sunshine' were migrated to 'normal'

## Rollback Plan

If needed, revert with:

```sql
UPDATE scenarios SET customer_emotion_level = 'sunshine' WHERE customer_emotion_level = 'normal';

ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS scenarios_customer_emotion_level_check;
ALTER TABLE scenarios ADD CONSTRAINT scenarios_customer_emotion_level_check
CHECK (customer_emotion_level IN ('sunshine', 'cold', 'in_a_hurry', 'angry', 'extremely_angry'));
```

Then revert code changes using git.
