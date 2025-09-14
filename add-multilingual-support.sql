-- Add multi-language support to Hokku Training Simulator
-- Run this in Supabase SQL Editor

-- Add language preference to users table
alter table users add column if not exists preferred_language text default 'en' check (preferred_language in ('en', 'ru', 'de', 'es', 'ka', 'fr', 'it'));

-- Update companies table for multi-language names
alter table companies add column if not exists name_i18n jsonb;

-- Create scenarios table for training scenarios (with multi-language support)
create table if not exists scenarios (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  title jsonb not null, -- {"en": "Customer Complaint", "ru": "Жалоба клиента", ...}
  description jsonb not null,
  industry text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  estimated_duration_minutes integer default 30,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table scenarios enable row level security;

-- Create training sessions table
create table if not exists training_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  scenario_id uuid references scenarios(id) on delete cascade,
  status text not null check (status in ('in_progress', 'completed', 'abandoned')) default 'in_progress',
  score integer check (score >= 0 and score <= 100),
  feedback jsonb, -- Multi-language feedback
  conversation_log jsonb, -- Store the conversation history
  started_at timestamptz default now(),
  completed_at timestamptz,
  duration_minutes integer
);

alter table training_sessions enable row level security;

-- RLS policies for scenarios
create policy "Users can view company scenarios" on scenarios
  for select using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );

create policy "Managers can manage scenarios" on scenarios
  for all using (
    company_id in (
      select company_id from company_members 
      where user_id = auth.uid() 
      and role in ('owner', 'manager')
    )
  );

-- RLS policies for training sessions
create policy "Users can view own sessions" on training_sessions
  for select using (user_id = auth.uid());

create policy "Users can create own sessions" on training_sessions
  for insert with check (user_id = auth.uid());

create policy "Users can update own sessions" on training_sessions
  for update using (user_id = auth.uid());

-- RLS policies for companies
create policy "Company members can view company" on companies
  for select using (
    id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );

create policy "Company owners can manage company" on companies
  for all using (owner_id = auth.uid());

-- RLS policies for company members
create policy "Company members can view members" on company_members
  for select using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );

create policy "Company owners and managers can manage members" on company_members
  for all using (
    company_id in (
      select company_id from company_members 
      where user_id = auth.uid() 
      and role in ('owner', 'manager')
    )
  );

-- Create function to update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add triggers for updated_at
create trigger update_users_updated_at
  before update on users
  for each row execute function update_updated_at();

create trigger update_scenarios_updated_at
  before update on scenarios
  for each row execute function update_updated_at();

-- Add some sample multi-language content helper functions
create or replace function get_localized_text(content jsonb, lang text default 'en')
returns text as $$
begin
  return coalesce(
    content ->> lang,
    content ->> 'en',
    content ->> (select key from jsonb_object_keys(content) key limit 1)
  );
end;
$$ language plpgsql;

-- Example usage: select get_localized_text(title, 'ru') from scenarios;