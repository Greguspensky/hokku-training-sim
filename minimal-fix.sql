-- Minimal fix - just add the missing INSERT policy
-- Run this in Supabase SQL Editor

-- Drop existing policies to avoid conflicts
drop policy if exists "Users can view own profile" on users;
drop policy if exists "Users can insert own profile" on users;  
drop policy if exists "Users can update own profile" on users;
drop policy if exists "Users can create own profile" on users;

-- Add all three policies fresh
create policy "Users can view own profile" on users
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on users
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on users
  for update using (auth.uid() = id);