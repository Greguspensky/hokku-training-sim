import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/track-assignments-standalone - Create a new track assignment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employee_id, track_id, assigned_by, notes } = body

    console.log('🔍 Creating track assignment:', { employee_id, track_id, assigned_by })

    // Validate required fields
    if (!employee_id || !track_id || !assigned_by) {
      return NextResponse.json({
        success: false,
        error: 'employee_id, track_id, and assigned_by are required'
      }, { status: 400 })
    }

    // Check if assignment already exists (using user_id for production schema)
    const { data: existingAssignment, error: checkError } = await supabaseAdmin
      .from('track_assignments')
      .select('id')
      .eq('user_id', employee_id)  // Using user_id for production schema
      .eq('track_id', track_id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.log('❌ Error checking existing assignment:', checkError.message)
      return NextResponse.json({
        success: false,
        error: 'Failed to check existing assignments'
      }, { status: 500 })
    }

    if (existingAssignment) {
      console.log('⚠️ Assignment already exists')
      return NextResponse.json({
        success: false,
        error: 'Employee already has this track assigned'
      }, { status: 409 })
    }

    console.log('✅ No existing assignment found, creating new one')

    // Create new assignment (using production schema - notes column may not exist)
    const newAssignment = {
      user_id: employee_id,  // Using user_id instead of employee_id for production
      track_id,
      assigned_by,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
      attempts_used: 0
    }

    const { data: assignment, error: createError } = await supabaseAdmin
      .from('track_assignments')
      .insert([newAssignment])
      .select('*')
      .single()

    if (createError) {
      console.log('❌ Error creating assignment:', createError.message)
      return NextResponse.json({
        success: false,
        error: 'Failed to create track assignment: ' + createError.message
      }, { status: 500 })
    }

    console.log('✅ Track assignment created successfully:', assignment.id)

    return NextResponse.json({
      success: true,
      assignment
    }, { status: 201 })

  } catch (error: any) {
    console.error('❌ Error creating track assignment:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create track assignment'
    }, { status: 500 })
  }
}

// GET /api/track-assignments-standalone - Get assignments for a company or employee
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const employeeId = searchParams.get('employee_id')

    console.log('🔍 Getting assignments:', { companyId, employeeId })

    if (employeeId) {
      // Get assignments for a specific employee (using user_id for production schema)
      const { data: assignments, error } = await supabaseAdmin
        .from('track_assignments')
        .select('*')
        .eq('user_id', employeeId)  // Using user_id for production schema
        .order('created_at', { ascending: false })

      if (error) {
        console.log('❌ Error fetching employee assignments:', error.message)
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch assignments'
        }, { status: 500 })
      }

      console.log(`✅ Found ${assignments?.length || 0} assignments for employee`)

      return NextResponse.json({
        success: true,
        assignments: assignments || []
      })

    } else if (companyId) {
      // Get all assignments for a company - we'd need to join with tracks to filter by company
      // For now, return all assignments (can be filtered on frontend)
      const { data: assignments, error } = await supabaseAdmin
        .from('track_assignments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.log('❌ Error fetching company assignments:', error.message)
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch assignments'
        }, { status: 500 })
      }

      console.log(`✅ Found ${assignments?.length || 0} assignments for company`)

      return NextResponse.json({
        success: true,
        assignments: assignments || []
      })

    } else {
      return NextResponse.json({
        success: false,
        error: 'Either company_id or employee_id is required'
      }, { status: 400 })
    }

  } catch (error: any) {
    console.error('❌ Error fetching track assignments:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch track assignments'
    }, { status: 500 })
  }
}