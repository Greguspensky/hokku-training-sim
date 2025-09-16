import { NextRequest, NextResponse } from 'next/server'
import { knowledgeBaseService, type CreateCategoryData } from '@/lib/knowledge-base'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id parameter is required' },
        { status: 400 }
      )
    }

    const categories = await knowledgeBaseService.getCategories(companyId)

    return NextResponse.json({
      success: true,
      categories,
      count: categories.length
    })

  } catch (error) {
    console.error('Get categories error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch categories' 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    }

    const body = await request.json()
    const categoryData: CreateCategoryData = {
      name: body.name,
      description: body.description,
      company_id: body.company_id
    }

    // Validate required fields
    if (!categoryData.name || !categoryData.description || !categoryData.company_id) {
      return NextResponse.json(
        { success: false, error: 'name, description, and company_id are required' },
        { status: 400 }
      )
    }

    const category = await knowledgeBaseService.createCategory(categoryData)

    return NextResponse.json({
      success: true,
      category,
      message: 'Category created successfully'
    })

  } catch (error) {
    console.error('Create category error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create category' 
      },
      { status: 500 }
    )
  }
}