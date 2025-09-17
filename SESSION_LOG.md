# Hokku Training Sim - Development Session Log

## Project Overview
A Next.js 15 training simulation platform with Supabase backend for employee training management.

## Current Status (2025-09-17)
- ✅ **MAJOR MILESTONE**: Employee management system fully operational
- ✅ Real database integration replacing hardcoded data
- ✅ Authentication system stable for managers and employees
- ✅ Auto-sync between Supabase Auth and users table

## Environment Setup
```bash
# Required Environment Variables (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://tscjbpdorbxmbxcqyiri.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY2picGRvcmJ4bWJ4Y3F5aXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNjQ2NjAsImV4cCI6MjA3Mjg0MDY2MH0.pjf_GMWVjuWibwSUGv3E2nuZ-asJ1q1nLU3T9xu0B-I
SUPABASE_SERVICE_ROLE_KEY=[CONFIGURED - bypasses RLS]
OPENAI_API_KEY=[CONFIGURED]

# Start Development Server
npm run dev  # Runs on port 3001 (3000 in use)
```

## Recent Major Fixes (Session: 2025-09-17)

### 1. Authentication System Overhaul
**Problem**: Infinite loading on sign-in for all users
**Solution**: Simplified AuthContext with email-based role detection
```typescript
// Key change in AuthContext.tsx
const isEmployeeUser = session.user.email?.includes('emp') || false
```
**Files Modified**: `src/contexts/AuthContext.tsx`

### 2. Employee Dashboard Crashes
**Problem**: React hooks order violations
**Solution**: Moved all useState hooks before conditional returns
**Files Modified**: `src/app/employee/page.tsx`

### 3. Manager Page Logout on Refresh
**Problem**: AuthContext loading state causing premature redirects
**Solution**: Added authLoading state check
**Files Modified**: `src/app/manager/employees/page.tsx`

### 4. Hardcoded Employee Data Issue
**Problem**: Employee list showed fake hardcoded data instead of real users
**Solution**:
- Removed hardcoded fallback employee list
- Added service role key for RLS bypass
- Created SQL sync script for auth.users → users table
**Files Modified**: `src/lib/employees.ts`, `src/lib/supabase.ts`

### 5. Auto-Sync Signup Process
**Problem**: New employees didn't appear until manual SQL script run
**Solution**: Modified signup API to auto-create users table records
**Files Modified**: `src/app/api/invite/signup/route.ts`

## Key Architecture Decisions

### Database Strategy
- **Supabase Auth**: Primary authentication system
- **users table**: Mirror of auth users for app queries (bypasses RLS with service role)
- **Auto-sync**: New signups automatically create users table records

### Role Detection
- **Email-based**: `email.includes('emp')` → employee, otherwise manager
- **Applied at**: Authentication, signup, and user creation

### RLS (Row Level Security)
- **Issue**: Anonymous key blocked by RLS policies
- **Solution**: Service role key bypasses RLS for employee queries
- **Implementation**: `supabaseAdmin` client in `src/lib/supabase.ts`

## Current User Base
```
Managers: greg@greg45.com, g3@greg.com
Employees: emp1@greg45.com through emp7@greg45.com (auto-synced)
```

## Testing URLs
- Manager Dashboard: http://localhost:3001/manager
- Employee Dashboard: http://localhost:3001/employee
- Employee Management: http://localhost:3001/manager/employees
- Sign In: http://localhost:3001/signin

## Known Working Features
- ✅ Manager/Employee authentication and routing
- ✅ Employee list displays real database users
- ✅ Employee invite system with auto-sync
- ✅ Page refresh without logout
- ✅ Real-time employee list updates

## SQL Scripts Created
- `sync-auth-users.sql` - Sync existing auth users to users table
- `create-user-function.sql` - RLS bypass function (not used)
- `create-track-assignments.sql` - Track assignment schema

## Next Session Priorities
1. Test employee dashboard functionality
2. Verify track assignment system
3. Test knowledge base features
4. Performance optimization if needed

## Development Notes
- **Port**: Using 3001 (3000 in use by another process)
- **Database**: All tables exist in Supabase
- **Authentication**: Stable and functional
- **Employee Management**: Production ready

## Last Updated
2025-09-17 - Post employee management system completion