import { NextRequest, NextResponse } from 'next/server'
import { knowledgeBaseService, type CreateCategoryData } from '@/lib/knowledge-base'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: {
    id: string
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    }

    const resolvedParams = await params
    const body = await request.json()
    
    const updateData: Partial<CreateCategoryData> = {
      name: body.name,
      description: body.description
    }

    // Validate required fields
    if (!updateData.name || !updateData.description) {
      return NextResponse.json(
        { success: false, error: 'name and description are required' },
        { status: 400 }
      )
    }

    const category = await knowledgeBaseService.updateCategory(resolvedParams.id, updateData)

    return NextResponse.json({
      success: true,
      category,
      message: 'Category updated successfully'
    })

  } catch (error) {
    console.error('Update category error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update category' 
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    
    // Temporarily allow demo mode for testing
    const demoUser = user || {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    }

    const resolvedParams = await params
    await knowledgeBaseService.deleteCategory(resolvedParams.id)

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully'
    })

  } catch (error) {
    console.error('Delete category error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete category' 
      },
      { status: 500 }
    )
  }
}