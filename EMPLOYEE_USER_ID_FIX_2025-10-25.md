# Employee User ID Data Integrity Fix - October 25, 2025

## Critical Data Integrity Issue ⚠️

**Problem**: Employees who have registered and logged in (`has_joined: true`) have `user_id: null` in the employees table, causing their training progress to not display in the manager view.

## Root Cause

When employees register/log in through the invite flow, their `user_id` (auth user ID) is not being set in the employees table. This breaks the link between:
- `employees` table (manager's view of employee)
- `question_attempts` table (stores progress by `user_id`)
- Other progress tracking tables

## Impact

**Manager View**:
- "Training Tracks" tab shows 0% progress even when employee has answered questions
- "Progress by Topic" tab shows no data
- Cannot see employee training history or stats

**Employee View**:
- Works correctly (uses auth context directly)
- Employee can see their own progress

## Affected Employees

As of 2025-10-25, these employees have `has_joined: true` but `user_id: null`:

1. **Maria Vasileva** (mvasileva@cam.cof) - ✅ FIXED
   - Employee ID: `2686212e-f9f1-4aa2-b313-c3120fa3946d`
   - Auth User ID: `58c1d351-0ee6-4137-9fff-b0ead7349dce`

2. **Tima** (tima@730.730) - ⚠️ NEEDS FIX
   - Employee ID: `898c90fa-15bd-4043-97ab-e4fb16907135`

3. **Test** (test@cam.cof) - ⚠️ NEEDS FIX
   - Employee ID: `322573a0-4264-417d-9edc-104d59fd0931`

4. **Sergey Novikov** (snovikov@cam.cof) - ⚠️ NEEDS FIX
   - Employee ID: `e372a9d3-85f2-4526-b56c-3ebda5e8c176`

5. **Nikita Marin** (nmarin@cam.cof) - ⚠️ NEEDS FIX
   - Employee ID: `ec40529f-49ac-48d5-bb19-1268f22f964b`

## Fix Applied (Maria Vasileva)

```sql
UPDATE employees
SET user_id = '58c1d351-0ee6-4137-9fff-b0ead7349dce'
WHERE id = '2686212e-f9f1-4aa2-b313-c3120fa3946d';
```

**Result**: Manager can now see Maria's training progress correctly.

## Long-Term Fix Needed

### 1. Fix Registration/Login Flow

**File to Check**: Likely in the invite acceptance or login handler

**Current Behavior**:
- Employee registers → auth user created
- Employee record updated: `has_joined: true`, `joined_at: timestamp`
- ❌ Missing: `user_id` not set

**Expected Behavior**:
- Employee registers → auth user created
- Employee record updated: `has_joined: true`, `joined_at: timestamp`, `user_id: <auth_user_id>`

### 2. Create Backfill Script

Create a script to fix existing employees:

```typescript
// backfill-employee-user-ids.ts
import { supabaseAdmin } from '@/lib/supabase'

async function backfillEmployeeUserIds() {
  // 1. Get all employees with has_joined=true and user_id=null
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, email')
    .eq('has_joined', true)
    .is('user_id', null)

  for (const employee of employees || []) {
    try {
      // 2. Look up auth user by email
      const response = await fetch(`http://localhost:3000/api/check-user-role?email=${employee.email}`)
      const data = await response.json()

      if (data.user?.id) {
        // 3. Update employee record
        await supabaseAdmin
          .from('employees')
          .update({ user_id: data.user.id })
          .eq('id', employee.id)

        console.log(`✅ Fixed ${employee.email}: ${data.user.id}`)
      } else {
        console.warn(`⚠️ No auth user found for ${employee.email}`)
      }
    } catch (error) {
      console.error(`❌ Error fixing ${employee.email}:`, error)
    }
  }
}
```

### 3. Add Database Trigger (Optional)

Create a trigger to automatically set `user_id` when `has_joined` changes to `true`:

```sql
CREATE OR REPLACE FUNCTION sync_employee_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.has_joined = true AND NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    -- Look up auth user by email
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE email = NEW.email
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employee_user_id_sync
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION sync_employee_user_id();
```

## Testing

After fixing an employee's `user_id`:

1. **Clear Cache**: Employee data cache in `EmployeeDashboardView.tsx` (line 29)
2. **Reload Manager Page**: Refresh the employee's dashboard view
3. **Verify**:
   - Training Tracks tab shows correct progress percentage
   - Progress by Topic tab shows question attempts
   - Training History tab shows completed sessions

## Related Files

- `src/components/Manager/EmployeeDashboardView.tsx` - Manager view (uses `authUserId`)
- `src/components/Employee/TrainingTrackCard.tsx` - Progress calculation
- `src/app/api/scenario-stats-batch/route.ts` - Queries by `user_id`
- `src/app/api/question-progress/route.ts` - Queries by `user_id`
- `src/app/api/check-user-role/route.ts` - Looks up user by email

## Priority

🔴 **HIGH PRIORITY** - This is a critical data integrity issue affecting manager visibility into employee training progress.

## Status

- ✅ Maria Vasileva fixed manually
- ✅ Progress calculation bug fixed (separate commit)
- ⚠️ 4 more employees need fixing
- ⚠️ Registration flow needs permanent fix
- ⚠️ Backfill script needs to be created

---

**Documented**: October 25, 2025
**Fixed By**: Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
