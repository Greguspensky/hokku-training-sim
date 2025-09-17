# Hokku Training Sim - Quick Setup Guide

## Fresh Start Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env.local.example` to `.env.local` and configure:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tscjbpdorbxmbxcqyiri.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon_key]
SUPABASE_SERVICE_ROLE_KEY=[service_role_key]  # CRITICAL for employee queries
OPENAI_API_KEY=[openai_key]
```

### 3. Database Sync (if needed)
If employee list is empty, run `sync-auth-users.sql` in Supabase SQL Editor.

### 4. Start Development
```bash
npm run dev  # Usually starts on port 3001
```

### 5. Test Key Features
- Manager login: greg@greg45.com
- Employee login: emp1@greg45.com (through emp7)
- Employee Management: /manager/employees

## Common Issues & Solutions

### "No employees yet" despite users in Supabase Auth
**Cause**: Missing service role key or users table sync
**Fix**:
1. Add `SUPABASE_SERVICE_ROLE_KEY` to .env.local
2. Run `sync-auth-users.sql`
3. Restart dev server

### Infinite loading on sign-in
**Cause**: AuthContext configuration issue
**Status**: ✅ FIXED in latest commit

### React hooks order violations
**Status**: ✅ FIXED in latest commit

## Architecture Quick Reference
- **Authentication**: Supabase Auth + email-based role detection
- **Employee Data**: Mirrored from auth.users to users table
- **RLS Bypass**: Service role key for employee queries
- **Auto-sync**: New signups automatically create user records