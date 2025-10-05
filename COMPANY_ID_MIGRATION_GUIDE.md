# Company ID Migration Guide

## Problem Fixed
Users from different companies were seeing each other's data because all users were using the same hardcoded company ID fallback: `01f773e2-1027-490e-8d36-279136700bbf`

## Changes Made

### 1. Database Schema ✅
- Added `company_id` column to `users` table
- Added index for faster queries
- Added foreign key constraint for data integrity

### 2. AuthContext Updated ✅
- Now fetches `company_id` from database
- Enriches user object with company_id on login

### 3. Hardcoded Fallbacks Removed ✅
Updated files to remove hardcoded fallback:
- `/src/app/manager/page.tsx` - Added company_id guard
- `/src/app/manager/employees/page.tsx` - Removed fallback
- `/src/app/manager/knowledge-base/page.tsx` - Added company_id guard
- `/src/app/employee/training/[assignmentId]/page.tsx` - Removed multiple fallbacks
- `/src/components/UserHeader.tsx` - Only shows company_id if present

## Migration Steps

### Step 1: Run SQL Migration in Supabase

1. Go to Supabase SQL Editor
2. Copy and paste this SQL:

```sql
-- Migration: Add company_id to users table

-- Step 1: Add company_id column to users table (using UUID to match companies.id type)
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID;

-- Step 2: Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- Step 3: Add foreign key constraint (for data integrity)
ALTER TABLE users ADD CONSTRAINT fk_users_company
  FOREIGN KEY (company_id) REFERENCES companies(id)
  ON DELETE SET NULL;

-- Verification query - check if column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'company_id';
```

3. Click "Run" to execute
4. Verify the verification query shows the `company_id` column

### Step 2: Update User Creation Function

Update the `create_user_record` function to automatically assign company_id:

1. Go to Supabase SQL Editor
2. Run the SQL from: `migrations/update_create_user_record_function.sql`

This function will:
- Assign `01f773e2-1027-490e-8d36-279136700bbf` to @greg45.com users
- Create new companies automatically for other domains
- Assign new company_id to users from different domains

### Step 3: Run Data Migration API

After the SQL migration and function update, run the data migration API:

```bash
curl -X POST http://localhost:3000/api/migrate-user-company
```

This will:
- Create a new company for `dasha@dar.dar` user (if not exists)
- Update dasha@dar.dar with the new company_id
- Update all other users with the original company_id: `01f773e2-1027-490e-8d36-279136700bbf`

Expected response:
```json
{
  "success": true,
  "message": "User company_id migration completed successfully",
  "stats": {
    "totalUsers": 5,
    "usersWithCompanyId": 5,
    "originalCompanyUsers": 4,
    "newCompanyUsers": 1,
    "newCompanyId": "uuid-of-new-company"
  }
}
```

### Step 4: Test Data Isolation

1. **Test Original Company Users (greg@greg45.com)**
   - Login as greg@greg45.com
   - Go to manager dashboard
   - Verify you see the original company's training tracks and scenarios
   - Check company ID in user dropdown menu (should be `01f773e2-1027-490e-8d36-279136700bbf`)
   - Open browser console and check for: `✅ Enriched user with role and company_id`

2. **Test New Company User (dasha@dar.dar)**
   - **First Sign-In**: Creates new user and new company automatically
     - Sign in as dasha@dar.dar for the FIRST time
     - Watch browser console for: `✅ Created user record on sign-in`
     - Check the response should include new company_id
   - **After Sign-In**:
     - Refresh the page (to reload with new company_id)
     - Go to manager dashboard
     - Verify you DON'T see the original company's data
     - Verify you see empty state (no training tracks yet)
     - Check company ID in user dropdown menu (should be a NEW UUID, different from greg45)

3. **Test Company ID Enforcement**
   - Try accessing knowledge base at `/manager/knowledge-base`
   - Try accessing employees page at `/manager/employees`
   - All pages should use the correct company_id from user context
   - If company_id is missing, should show "Company ID Missing" error message

4. **Verify Database State**
   Run this in Supabase SQL Editor:
   ```sql
   SELECT u.email, u.role, u.company_id, c.name as company_name
   FROM users u
   LEFT JOIN companies c ON u.company_id = c.id
   ORDER BY u.email;
   ```

   Expected results:
   - All @greg45.com users → same company_id + original company name
   - dasha@dar.dar → different company_id + "dar Company" name

## Rollback (If Needed)

If something goes wrong, you can rollback by running:

```sql
-- Remove company_id column and all constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_company;
DROP INDEX IF EXISTS idx_users_company_id;
ALTER TABLE users DROP COLUMN IF EXISTS company_id;
```

Then restore the hardcoded fallbacks in the code.

## Files Changed

### Database
- `migrations/add_company_id_to_users.sql` - SQL migration script

### API Routes
- `src/app/api/migrate-user-company/route.ts` - Data migration API

### Context
- `src/contexts/AuthContext.tsx` - Fetches company_id from database

### Pages (Removed Hardcoded Fallbacks)
- `src/app/manager/page.tsx`
- `src/app/manager/employees/page.tsx`
- `src/app/manager/knowledge-base/page.tsx`
- `src/app/employee/training/[assignmentId]/page.tsx`

### Components
- `src/components/UserHeader.tsx` - Only shows company_id if present

## Testing Checklist

- [ ] SQL migration runs successfully in Supabase
- [ ] Data migration API returns success
- [ ] All users have company_id assigned
- [ ] greg@greg45.com sees only original company data
- [ ] dasha@dar.dar sees only new company data (empty state)
- [ ] Company ID shown in user dropdown menu is correct
- [ ] Manager dashboard loads without errors
- [ ] Knowledge base page loads without errors
- [ ] Employee training page loads without errors
- [ ] No console errors about missing company_id

## Current Users

Based on typical setup:
- **greg@greg45.com** - Original company (manager)
- **emp1@test.com** - Original company (employee)
- **emp2@test.com** - Original company (employee)
- **dasha@dar.dar** - NEW company (manager)

After migration, dasha@dar.dar will be in a separate company and won't see data from the other users.

## Notes

- Test API routes (like `/api/test-ai-extraction`) still use hardcoded company IDs - this is okay for testing
- Documentation files were not modified (they still reference the old hardcoded ID as examples)
- The migration API is safe to run multiple times - it checks if users already have company_id before updating
