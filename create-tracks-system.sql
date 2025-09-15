-- Create tracks table and update scenarios for track-based system
-- Run this in Supabase SQL Editor

-- Create tracks table
create table if not exists tracks (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  description text not null,
  target_audience text not null check (target_audience in ('new_hire', 'existing_employee')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tracks enable row level security;

-- Update scenarios table to work with tracks (remove jsonb fields)
alter table scenarios drop column if exists title;
alter table scenarios drop column if exists description;
alter table scenarios add column if not exists track_id uuid references tracks(id) on delete cascade;
alter table scenarios add column if not exists title text not null default '';
alter table scenarios add column if not exists description text not null default '';
alter table scenarios add column if not exists scenario_type text not null check (scenario_type in ('theory', 'service_practice')) default 'theory';
alter table scenarios add column if not exists template_type text not null check (template_type in ('upset_customer', 'upselling', 'general_flow', 'conflict_resolution')) default 'general_flow';
alter table scenarios add column if not exists client_behavior text not null default '';
alter table scenarios add column if not exists expected_response text not null default '';

-- Remove industry column (not needed in track-based system)
alter table scenarios drop column if exists industry;

-- RLS policies for tracks
create policy "Users can view company tracks" on tracks
  for select using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );

create policy "Managers can manage tracks" on tracks
  for all using (
    company_id in (
      select company_id from company_members 
      where user_id = auth.uid() 
      and role in ('owner', 'manager')
    )
  );

-- Add trigger for tracks updated_at
create trigger update_tracks_updated_at
  before update on tracks
  for each row execute function update_updated_at();