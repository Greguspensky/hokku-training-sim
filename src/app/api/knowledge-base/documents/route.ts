import { NextRequest, NextResponse } from 'next/server'
import { knowledgeBaseService, type CreateDocumentData } from '@/lib/knowledge-base'
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
    const categoryId = searchParams.get('category_id')
    const searchQuery = searchParams.get('search')

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id parameter is required' },
        { status: 400 }
      )
    }

    let documents
    if (searchQuery) {
      documents = await knowledgeBaseService.searchDocuments(companyId, searchQuery)
    } else {
      documents = await knowledgeBaseService.getDocuments(companyId, categoryId || undefined)
    }

    return NextResponse.json({
      success: true,
      documents,
      count: documents.length
    })

  } catch (error) {
    console.error('Get documents error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch documents' 
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
    const documentData: CreateDocumentData = {
      category_id: body.category_id,
      title: body.title,
      content: body.content,
      item_type: body.item_type || 'info',
      file_url: body.file_url,
      file_type: body.file_type || 'text',
      file_size: body.file_size,
      company_id: body.company_id
    }

    // Validate required fields
    if (!documentData.category_id || !documentData.title || !documentData.content || !documentData.company_id) {
      return NextResponse.json(
        { success: false, error: 'category_id, title, content, and company_id are required' },
        { status: 400 }
      )
    }

    const document = await knowledgeBaseService.createDocument(documentData)

    return NextResponse.json({
      success: true,
      document,
      message: 'Document created successfully'
    })

  } catch (error) {
    console.error('Create document error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create document' 
      },
      { status: 500 }
    )
  }
}