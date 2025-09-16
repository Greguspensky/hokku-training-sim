-- Script to sync Supabase Auth users to the users table
-- Run this in the Supabase SQL Editor

-- Temporarily disable RLS for the operation
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Insert users based on auth.users, determining role from email
INSERT INTO users (id, email, name, role, created_at)
SELECT
    id,
    email,
    COALESCE(
        NULLIF(raw_user_meta_data->>'name', ''),
        SPLIT_PART(email, '@', 1)
    ) as name,
    CASE
        WHEN email LIKE '%emp%' THEN 'employee'::text
        ELSE 'manager'::text
    END as role,
    created_at
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Show the results
SELECT email, role, created_at FROM users ORDER BY created_at;