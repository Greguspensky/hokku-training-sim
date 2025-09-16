#!/usr/bin/env node

/**
 * Database Backup Script for Hokku Training Sim
 *
 * This script creates backups of your Supabase database data
 * to prevent data loss during development updates.
 *
 * Usage:
 *   node scripts/backup-database.js
 *   node scripts/backup-database.js restore backup-2025-09-16.json
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs').promises
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in .env.local')
  process.exit(1)
}

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
  console.error('💡 Using NEXT_PUBLIC_SUPABASE_ANON_KEY instead (limited permissions)')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const TABLES_TO_BACKUP = [
  'companies',
  'company_members',
  'tracks',
  'scenarios',
  'knowledge_base_categories',
  'knowledge_base_documents',
  'employee_invites',
  'users' // Note: this might be limited by RLS policies
]

async function backupData() {
  const timestamp = new Date().toISOString().split('T')[0]
  const backupData = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    tables: {}
  }

  console.log('📦 Starting database backup...')

  for (const tableName of TABLES_TO_BACKUP) {
    try {
      console.log(`   Backing up ${tableName}...`)

      const { data, error } = await supabase
        .from(tableName)
        .select('*')

      if (error) {
        console.warn(`   ⚠️  Warning: Could not backup ${tableName}:`, error.message)
        continue
      }

      backupData.tables[tableName] = data || []
      console.log(`   ✅ ${tableName}: ${data?.length || 0} records`)

    } catch (err) {
      console.warn(`   ⚠️  Error backing up ${tableName}:`, err.message)
    }
  }

  // Ensure backups directory exists
  const backupsDir = path.join(process.cwd(), 'backups')
  try {
    await fs.mkdir(backupsDir, { recursive: true })
  } catch (err) {
    // Directory might already exist
  }

  // Write backup file
  const backupFile = path.join(backupsDir, `backup-${timestamp}.json`)
  await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2))

  console.log(`\n✅ Backup completed!`)
  console.log(`📁 Backup saved to: ${backupFile}`)

  // Keep only last 10 backups
  await cleanOldBackups(backupsDir)

  return backupFile
}

async function cleanOldBackups(backupsDir) {
  try {
    const files = await fs.readdir(backupsDir)
    const backupFiles = files
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse()

    // Keep only the 10 most recent backups
    const filesToDelete = backupFiles.slice(10)

    for (const file of filesToDelete) {
      await fs.unlink(path.join(backupsDir, file))
      console.log(`🗑️  Cleaned old backup: ${file}`)
    }
  } catch (err) {
    console.warn('Warning: Could not clean old backups:', err.message)
  }
}

async function restoreData(backupFile) {
  console.log(`🔄 Starting restore from ${backupFile}...`)

  const backupPath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(process.cwd(), 'backups', backupFile)

  let backupData
  try {
    const content = await fs.readFile(backupPath, 'utf8')
    backupData = JSON.parse(content)
  } catch (err) {
    console.error(`❌ Could not read backup file: ${err.message}`)
    process.exit(1)
  }

  console.log(`📅 Backup from: ${backupData.timestamp}`)

  // Restore in order (respecting foreign key constraints)
  const restoreOrder = [
    'companies',
    'users', // If available
    'company_members',
    'tracks',
    'scenarios',
    'knowledge_base_categories',
    'knowledge_base_documents',
    'employee_invites'
  ]

  for (const tableName of restoreOrder) {
    const tableData = backupData.tables[tableName]
    if (!tableData || tableData.length === 0) {
      console.log(`   ⏭️  Skipping ${tableName} (no data)`)
      continue
    }

    try {
      console.log(`   Restoring ${tableName} (${tableData.length} records)...`)

      // Insert data in batches to avoid size limits
      const batchSize = 100
      for (let i = 0; i < tableData.length; i += batchSize) {
        const batch = tableData.slice(i, i + batchSize)

        const { error } = await supabase
          .from(tableName)
          .upsert(batch, {
            onConflict: 'id',
            ignoreDuplicates: false
          })

        if (error) {
          console.warn(`   ⚠️  Warning restoring ${tableName} batch ${Math.floor(i/batchSize) + 1}:`, error.message)
        }
      }

      console.log(`   ✅ ${tableName} restored`)

    } catch (err) {
      console.warn(`   ⚠️  Error restoring ${tableName}:`, err.message)
    }
  }

  console.log(`\n✅ Restore completed!`)
}

async function listBackups() {
  const backupsDir = path.join(process.cwd(), 'backups')

  try {
    const files = await fs.readdir(backupsDir)
    const backupFiles = files
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse()

    if (backupFiles.length === 0) {
      console.log('📭 No backups found')
      return
    }

    console.log('📦 Available backups:')
    for (const file of backupFiles) {
      const filePath = path.join(backupsDir, file)
      const stats = await fs.stat(filePath)
      console.log(`   ${file} (${stats.size} bytes, ${stats.mtime.toLocaleDateString()})`)
    }
  } catch (err) {
    console.log('📭 No backups directory found')
  }
}

// CLI Interface
async function main() {
  const command = process.argv[2]
  const arg = process.argv[3]

  try {
    switch (command) {
      case 'restore':
        if (!arg) {
          console.error('❌ Please specify backup file to restore')
          console.log('Usage: node scripts/backup-database.js restore backup-2025-09-16.json')
          process.exit(1)
        }
        await restoreData(arg)
        break

      case 'list':
        await listBackups()
        break

      case 'backup':
      default:
        await backupData()
        break
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { backupData, restoreData }