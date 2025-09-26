-- Simple Hokku Training Simulator Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table
create table if not exists users (
  id uuid primary key default auth.uid(),
  email text unique not null,
  name text not null,
  role text not null check (role in ('manager', 'employee')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table users enable row level security;

-- RLS policies for users
create policy "Users can view own profile" on users
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on users
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on users
  for update using (auth.uid() = id);

-- Companies table  
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid references users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table companies enable row level security;

-- Company members table
create table if not exists company_members (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'employee')),
  created_at timestamptz default now(),
  unique(company_id, user_id)
);

alter table company_members enable row level security;

-- Training Sessions table
create table if not exists training_sessions (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null,
  assignment_id text not null,
  company_id uuid references companies(id) on delete cascade,
  session_name text not null,
  training_mode text not null check (training_mode in ('theory', 'service_practice')),
  language text not null,
  agent_id text not null,
  knowledge_context jsonb,
  conversation_transcript jsonb not null,
  session_duration_seconds integer not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz default now()
);

alter table training_sessions enable row level security;

-- RLS policies for training_sessions
create policy "Users can view own training sessions" on training_sessions
  for select using (
    employee_id::text = auth.uid()::text OR
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role in ('owner', 'manager')
    )
  );

create policy "Users can insert own training sessions" on training_sessions
  for insert with check (employee_id::text = auth.uid()::text);

-- Index for faster queries
create index if not exists idx_training_sessions_employee_id on training_sessions(employee_id);
create index if not exists idx_training_sessions_company_id on training_sessions(company_id);
create index if not exists idx_training_sessions_created_at on training_sessions(created_at desc);