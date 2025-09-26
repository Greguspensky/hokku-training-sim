-- Create initial users for Hokku Training System
-- Run this in the Supabase SQL Editor

-- Create initial manager user
-- First, you need to sign up through the UI with this email, then run this script

INSERT INTO public.users (
  id,
  email,
  name,
  role,
  company_id,
  created_at,
  updated_at
) VALUES (
  'REPLACE_WITH_MANAGER_UUID', -- Replace with actual UUID from auth.users after signup
  'manager@hokku.com',
  'Training Manager',
  'manager',
  '01f773e2-1027-490e-8d36-279136700bbf',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  company_id = EXCLUDED.company_id,
  updated_at = NOW();

-- Create initial employee user
INSERT INTO public.users (
  id,
  email,
  name,
  role,
  company_id,
  created_at,
  updated_at
) VALUES (
  'REPLACE_WITH_EMPLOYEE_UUID', -- Replace with actual UUID from auth.users after signup
  'employee@hokku.com',
  'Demo Employee',
  'employee',
  '01f773e2-1027-490e-8d36-279136700bbf',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  company_id = EXCLUDED.company_id,
  updated_at = NOW();

-- Instructions:
-- 1. First sign up through the app UI using manager@hokku.com
-- 2. Check auth.users table to get the UUID
-- 3. Replace REPLACE_WITH_MANAGER_UUID with the actual UUID
-- 4. Repeat for employee@hokku.com
-- 5. Run this script in Supabase SQL Editor