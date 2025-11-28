import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔧 Starting user company_id migration...')

    // Step 1: Check if company_id column exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id, email, company_id')
      .limit(1)

    if (checkError) {
      if (checkError.message.includes('column "company_id" does not exist') ||
          checkError.message.includes('company_id') && checkError.message.includes('does not exist')) {
        return NextResponse.json({
          error: 'company_id column does not exist',
          message: 'Please run the SQL migration first',
          instructions: [
            '1. Go to Supabase SQL Editor',
            '2. Run the SQL from: migrations/add_company_id_to_users.sql',
            '3. Then run this API again'
          ],
          sql: `
-- Run this in Supabase SQL Editor:
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
ALTER TABLE users ADD CONSTRAINT fk_users_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
          `.trim()
        }, { status: 400 })
      }
      throw checkError
    }

    console.log('✅ company_id column exists')

    // Step 3: Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, company_id')

    if (usersError) throw usersError
    console.log(`📊 Found ${users?.length || 0} users`)

    // Step 4: Get all companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')

    if (companiesError) throw companiesError
    console.log(`📊 Found ${companies?.length || 0} companies`)

    const originalCompanyId = '01f773e2-1027-490e-8d36-279136700bbf'
    let newCompanyId = null

    // Step 5: Create new company for dasha@dar.dar if needed
    const dashaUser = users?.find(u => u.email === 'dasha@dar.dar')
    if (dashaUser && !dashaUser.company_id) {
      // Check if a company already exists for Dar
      const darCompany = companies?.find(c => c.name.toLowerCase().includes('dar'))

      if (darCompany) {
        newCompanyId = darCompany.id
        console.log(`✅ Found existing company for Dar: ${darCompany.name}`)
      } else {
        // Create new company
        const { data: newCompany, error: createCompanyError } = await supabase
          .from('companies')
          .insert({
            name: 'Dar Company',
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (createCompanyError) throw createCompanyError
        newCompanyId = newCompany.id
        console.log(`✅ Created new company: ${newCompany.name} (${newCompanyId})`)
      }

      // Update dasha user with new company_id
      const { error: updateDashaError } = await supabase
        .from('users')
        .update({ company_id: newCompanyId })
        .eq('id', dashaUser.id)

      if (updateDashaError) throw updateDashaError
      console.log(`✅ Updated dasha@dar.dar with company_id: ${newCompanyId}`)
    }

    // Step 6: Update all other users without company_id to original company
    const usersToUpdate = users?.filter(u =>
      !u.company_id && u.email !== 'dasha@dar.dar'
    ) || []

    if (usersToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ company_id: originalCompanyId })
        .in('id', usersToUpdate.map(u => u.id))

      if (updateError) throw updateError
      console.log(`✅ Updated ${usersToUpdate.length} users with original company_id`)
    }

    // Step 7: Get final state
    const { data: finalUsers, error: finalError } = await supabase
      .from('users')
      .select('id, email, company_id')

    if (finalError) throw finalError

    return NextResponse.json({
      success: true,
      message: 'User company_id migration completed successfully',
      stats: {
        totalUsers: finalUsers?.length || 0,
        usersWithCompanyId: finalUsers?.filter(u => u.company_id).length || 0,
        originalCompanyUsers: finalUsers?.filter(u => u.company_id === originalCompanyId).length || 0,
        newCompanyUsers: newCompanyId ? finalUsers?.filter(u => u.company_id === newCompanyId).length || 0 : 0,
        newCompanyId: newCompanyId
      },
      users: finalUsers
    })

  } catch (error: any) {
    console.error('❌ Migration error:', error)
    return NextResponse.json(
      {
        error: error.message,
        details: error.toString()
      },
      { status: 500 }
    )
  }
}
