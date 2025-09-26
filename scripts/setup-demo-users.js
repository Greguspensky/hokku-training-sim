#!/usr/bin/env node

/**
 * Setup script to create demo users in Supabase
 * Run this script to create initial test users
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Setting up demo users...')
console.log('Supabase URL:', supabaseUrl)

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in .env.local')
  process.exit(1)
}

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found. Using anon key (limited functionality)')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createDemoUsers() {
  const demoUsers = [
    {
      email: 'manager@hokku.com',
      password: 'manager123',
      name: 'Demo Manager',
      role: 'manager'
    },
    {
      email: 'employee@hokku.com',
      password: 'employee123',
      name: 'Demo Employee',
      role: 'employee'
    },
    {
      email: 'greg@greg45.com',
      password: 'greg123',
      name: 'Greg Test',
      role: 'manager'
    }
  ]

  console.log('Creating demo users...')

  for (const user of demoUsers) {
    try {
      console.log(`Creating user: ${user.email}`)

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true
      })

      if (authError) {
        console.log(`⚠️ Auth error for ${user.email}:`, authError.message)
        continue
      }

      if (authData.user) {
        console.log(`✅ Auth user created: ${authData.user.id}`)

        // Create profile in users table
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: authData.user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            company_id: '01f773e2-1027-490e-8d36-279136700bbf',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (profileError) {
          console.log(`⚠️ Profile error for ${user.email}:`, profileError.message)
        } else {
          console.log(`✅ Profile created for ${user.email}`)
        }
      }
    } catch (error) {
      console.log(`❌ Error creating ${user.email}:`, error.message)
    }
  }
}

async function main() {
  try {
    await createDemoUsers()
    console.log('\n🎉 Demo users setup complete!')
    console.log('\nYou can now sign in with:')
    console.log('📧 manager@hokku.com / manager123 (Manager)')
    console.log('📧 employee@hokku.com / employee123 (Employee)')
    console.log('📧 greg@greg45.com / greg123 (Manager)')
  } catch (error) {
    console.error('❌ Setup failed:', error.message)
  }
}

if (require.main === module) {
  main()
}