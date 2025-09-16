import { NextRequest, NextResponse } from 'next/server'
import { knowledgeBaseService, type CreateDocumentData } from '@/lib/knowledge-base'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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
    const document = await knowledgeBaseService.getDocument(resolvedParams.id)
    
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      document
    })

  } catch (error) {
    console.error('Get document error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch document' 
      },
      { status: 500 }
    )
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
    
    const updateData: Partial<CreateDocumentData> = {
      title: body.title,
      content: body.content,
      category_id: body.category_id,
      file_url: body.file_url,
      file_type: body.file_type,
      file_size: body.file_size
    }

    const document = await knowledgeBaseService.updateDocument(resolvedParams.id, updateData)

    return NextResponse.json({
      success: true,
      document,
      message: 'Document updated successfully'
    })

  } catch (error) {
    console.error('Update document error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update document' 
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
    await knowledgeBaseService.deleteDocument(resolvedParams.id)

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })

  } catch (error) {
    console.error('Delete document error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document' 
      },
      { status: 500 }
    )
  }
}