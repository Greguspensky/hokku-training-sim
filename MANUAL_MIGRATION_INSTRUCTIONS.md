# Manual Database Migration Required

## Emotion Level Update (2025-10-15)

The emotion level migration requires manual SQL execution in Supabase Dashboard because the constraint must be dropped before data migration.

### Steps:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `hokku-training-sim`
   - Navigate to: **SQL Editor**

2. **Copy and Execute This SQL:**

```sql
-- Step 1: Drop the existing constraint
ALTER TABLE scenarios
DROP CONSTRAINT IF EXISTS scenarios_customer_emotion_level_check;

-- Step 2: Migrate existing data
UPDATE scenarios
SET customer_emotion_level = 'sunshine'
WHERE customer_emotion_level = 'calm';

UPDATE scenarios
SET customer_emotion_level = 'in_a_hurry'
WHERE customer_emotion_level = 'frustrated';

-- Step 3: Add new constraint with updated values
ALTER TABLE scenarios
ADD CONSTRAINT scenarios_customer_emotion_level_check
CHECK (customer_emotion_level IN ('sunshine', 'cold', 'in_a_hurry', 'angry', 'extremely_angry'));

-- Step 4: Update default value
ALTER TABLE scenarios
ALTER COLUMN customer_emotion_level SET DEFAULT 'sunshine';

-- Step 5: Verify migration
SELECT customer_emotion_level, COUNT(*) as count
FROM scenarios
GROUP BY customer_emotion_level
ORDER BY customer_emotion_level;
```

3. **Click "Run"**

4. **Verify Output**
   - Should show updated emotion levels: `sunshine`, `in_a_hurry`, `angry`, `extremely_angry`
   - No errors should appear

### New Emotion Levels:

| Old Name | New Name | Icon | Description |
|----------|----------|------|-------------|
| calm | **sunshine** | ☀️ | Warm, positive customer |
| *(new)* | **cold** | 🧊 | Neutral, skeptical, urban |
| frustrated | **in_a_hurry** | ⏱️ | Time-pressured customer |
| angry | angry | 😠 | (unchanged) |
| extremely_angry | extremely_angry | 🤬 | (unchanged) |

### After Migration:

The TypeScript code has already been updated. Once the SQL migration is complete, the system will work with the new emotion names automatically.
