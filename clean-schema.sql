-- Clean Hokku Training Simulator Database Schema
-- Run this in Supabase SQL Editor

-- First, drop existing policies and tables if they exist
drop policy if exists "Users can view own profile" on users;
drop policy if exists "Users can insert own profile" on users;
drop policy if exists "Users can update own profile" on users;
drop policy if exists "Users can create own profile" on users;

drop table if exists company_members cascade;
drop table if exists companies cascade;
drop table if exists users cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table
create table users (
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
create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid references users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table companies enable row level security;

-- Company members table
create table company_members (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'employee')),
  created_at timestamptz default now(),
  unique(company_id, user_id)
);

alter table company_members enable row level security;