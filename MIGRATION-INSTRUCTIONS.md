# Database Migration Instructions

To fix the scenario creation issue, you need to add the missing knowledge base columns to the `scenarios` table.

## Steps:

1. **Go to your Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Select your project
   - Go to "SQL Editor" in the left sidebar

2. **Run this SQL command:**

```sql
-- Add knowledge base association columns to scenarios table
ALTER TABLE scenarios
ADD COLUMN IF NOT EXISTS knowledge_category_ids TEXT[],
ADD COLUMN IF NOT EXISTS knowledge_document_ids TEXT[];

-- Add comment to explain the new columns
COMMENT ON COLUMN scenarios.knowledge_category_ids IS 'Array of knowledge base category IDs associated with this theory scenario';
COMMENT ON COLUMN scenarios.knowledge_document_ids IS 'Array of knowledge base document IDs associated with this theory scenario';
```

3. **Click "Run" to execute the SQL**

4. **Verify the columns were added:**

```sql
-- Check the scenarios table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'scenarios'
  AND column_name IN ('knowledge_category_ids', 'knowledge_document_ids');
```

## After running this migration:

- Your scenario creation form will work properly
- You'll be able to create theory scenarios with knowledge base associations
- The AI question generation will use the selected knowledge base content

## Error before fix:
```
Could not find the 'knowledge_category_ids' column of 'scenarios' in the schema cache
```

## Expected result after fix:
✅ Scenarios can be created with knowledge base selections
✅ Theory scenarios will generate AI questions from selected documents
✅ Training system will work with your existing "Prices" knowledge base content