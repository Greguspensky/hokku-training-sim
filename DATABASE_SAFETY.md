# 🛡️ Database Safety Guide

## Problem: Database Clearing During Updates

Your database has been clearing because of **destructive SQL migrations** that contain commands like:
- `DROP COLUMN`
- `DROP TABLE`
- `TRUNCATE`
- Recreating tables without preserving data

## 🚨 CRITICAL: Always Backup Before Changes

**NEVER run any SQL migration without backing up first!**

```bash
# Create backup before ANY database changes
npm run db:backup

# List available backups
npm run db:list-backups

# Restore if something goes wrong
npm run db:restore backup-2025-09-16.json
```

## 🔧 How to Use the Backup System

### 1. Before Making Changes
```bash
npm run db:backup
```
This creates a timestamped backup in the `backups/` folder.

### 2. After Breaking Something
```bash
npm run db:list-backups
npm run db:restore backup-2025-09-16.json
```

### 3. Automatic Cleanup
- Keeps only the 10 most recent backups
- Backups are stored in `backups/backup-YYYY-MM-DD.json`

## 📋 Safe Migration Practices

### ✅ SAFE Commands
```sql
-- Adding new columns
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS new_field TEXT;

-- Creating new tables
CREATE TABLE IF NOT EXISTS new_table (...);

-- Adding indexes
CREATE INDEX IF NOT EXISTS idx_name ON table(column);

-- Updating data
UPDATE scenarios SET field = 'value' WHERE condition;
```

### ❌ DANGEROUS Commands (Avoid!)
```sql
-- These will DELETE your data!
DROP COLUMN old_field;           -- ❌ Deletes all data in column
DROP TABLE old_table;            -- ❌ Deletes entire table
TRUNCATE scenarios;              -- ❌ Deletes all rows
ALTER TABLE scenarios DROP ...;  -- ❌ Deletes columns/constraints
```

## 🔄 Safe Update Workflow

1. **Backup First**: `npm run db:backup`
2. **Test Migration**: Run on a copy of your data
3. **Apply Changes**: Run your SQL in Supabase
4. **Verify**: Check that your data is still there
5. **If Problems**: `npm run db:restore latest-backup.json`

## 🏗️ The Root Cause

Looking at your migration files, I found the problem:

**File: `create-tracks-system.sql`**
```sql
-- These lines DELETE your data!
alter table scenarios drop column if exists title;        -- ❌
alter table scenarios drop column if exists description;  -- ❌
alter table scenarios drop column if exists industry;     -- ❌
```

## 🔧 Better Migration Approach

Instead of dropping and recreating, migrate data safely:

```sql
-- SAFE: Add new columns first
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS new_title TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS new_description TEXT;

-- SAFE: Copy data from old to new columns
UPDATE scenarios
SET new_title = title,
    new_description = description
WHERE new_title IS NULL;

-- SAFE: Only drop old columns after verifying new ones work
-- (And only if absolutely necessary!)
```

## 📊 What Gets Backed Up

The backup system saves:
- ✅ Companies and company members
- ✅ Training tracks and scenarios
- ✅ Knowledge base categories and documents
- ✅ Employee invites
- ✅ User data (limited by permissions)

## 🛠️ Recovery Examples

### Scenario 1: "My scenarios disappeared!"
```bash
npm run db:restore backup-2025-09-16.json
```

### Scenario 2: "I want to see what backups I have"
```bash
npm run db:list-backups
```

### Scenario 3: "Create backup before risky changes"
```bash
npm run db:backup
# Then proceed with your changes
```

## 🎯 Best Practices

1. **Backup before every SQL change**
2. **Test migrations on staging data first**
3. **Never run `DROP` commands in production**
4. **Keep old columns until new ones are proven to work**
5. **Use `IF NOT EXISTS` and `IF EXISTS` for safety**

## 🚀 Next Steps

1. Create a backup right now: `npm run db:backup`
2. Re-enter your knowledge base content
3. Before any future schema changes, backup first
4. Consider using the safer migration patterns shown above

---

**Remember**: Your data is precious! Always backup before making changes. 💾