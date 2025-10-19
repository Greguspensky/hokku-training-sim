import { supabaseAdmin } from './supabase'

export type ItemType = 'menu_item' | 'add_on' | 'sop' | 'info'

export interface KnowledgeBaseCategory {
  id: string
  company_id: string
  name: string
  description: string
  created_at: string
  updated_at: string
  document_count?: number
}

export interface KnowledgeBaseDocument {
  id: string
  company_id: string
  category_id: string
  title: string
  content: string
  item_type: ItemType
  file_url?: string
  file_type: 'text' | 'pdf' | 'doc' | 'docx' | 'txt'
  file_size?: number
  created_at: string
  updated_at: string
  category?: KnowledgeBaseCategory
}

export interface CreateCategoryData {
  name: string
  description: string
  company_id: string
}

export interface CreateDocumentData {
  category_id: string
  title: string
  content: string
  item_type: ItemType
  file_url?: string
  file_type: KnowledgeBaseDocument['file_type']
  file_size?: number
  company_id: string
}

// These are initial categories that can be created for new companies
export const DEFAULT_CATEGORIES: Omit<KnowledgeBaseCategory, 'id' | 'company_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Standard Operating Procedures',
    description: 'Step-by-step processes and operational procedures'
  },
  {
    name: 'Pricing & Menu',
    description: 'Product pricing, menu items, and service offerings'
  },
  {
    name: 'Policies & Guidelines',
    description: 'Company policies, rules, and employee guidelines'
  },
  {
    name: 'Customer Service Scripts',
    description: 'Templates, responses, and conversation guides'
  },
  {
    name: 'Training Materials',
    description: 'Educational content and skill development resources'
  },
  {
    name: 'Company Information',
    description: 'Mission, values, history, and organizational details'
  }
]


class KnowledgeBaseService {
  // Categories
  async getCategories(companyId: string): Promise<KnowledgeBaseCategory[]> {
    const { data: categories, error } = await supabaseAdmin
      .from('knowledge_base_categories')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
      throw new Error('Failed to fetch categories')
    }

    // Add document counts
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const { count } = await supabaseAdmin
          .from('knowledge_base_documents')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)

        return {
          ...category,
          document_count: count || 0
        }
      })
    )

    return categoriesWithCounts
  }

  async createCategory(data: CreateCategoryData): Promise<KnowledgeBaseCategory> {
    const { data: category, error } = await supabaseAdmin
      .from('knowledge_base_categories')
      .insert({
        name: data.name,
        description: data.description,
        company_id: data.company_id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating category:', error)
      throw new Error('Failed to create category')
    }

    return category
  }

  async updateCategory(id: string, data: Partial<CreateCategoryData>): Promise<KnowledgeBaseCategory> {
    const { data: category, error } = await supabaseAdmin
      .from('knowledge_base_categories')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating category:', error)
      throw new Error('Category not found or failed to update')
    }

    return category
  }

  async deleteCategory(id: string): Promise<void> {
    // Delete all documents in this category first (CASCADE should handle this, but being explicit)
    const { error: docsError } = await supabaseAdmin
      .from('knowledge_base_documents')
      .delete()
      .eq('category_id', id)

    if (docsError) {
      console.error('Error deleting documents:', docsError)
    }

    // Delete the category
    const { error } = await supabaseAdmin
      .from('knowledge_base_categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting category:', error)
      throw new Error('Failed to delete category')
    }
  }

  // Documents
  async getDocuments(companyId: string, categoryId?: string): Promise<KnowledgeBaseDocument[]> {
    let query = supabaseAdmin
      .from('knowledge_base_documents')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    const { data: documents, error } = await query

    if (error) {
      console.error('Error fetching documents:', error)
      throw new Error('Failed to fetch documents')
    }

    return documents || []
  }

  async getDocument(id: string): Promise<KnowledgeBaseDocument | null> {
    const { data: document, error } = await supabaseAdmin
      .from('knowledge_base_documents')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Document not found
      }
      console.error('Error fetching document:', error)
      throw new Error('Failed to fetch document')
    }

    return document
  }

  async createDocument(data: CreateDocumentData): Promise<KnowledgeBaseDocument> {
    const { data: document, error } = await supabaseAdmin
      .from('knowledge_base_documents')
      .insert({
        category_id: data.category_id,
        title: data.title,
        content: data.content,
        item_type: data.item_type,
        file_url: data.file_url,
        file_type: data.file_type,
        file_size: data.file_size,
        company_id: data.company_id
      })
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .single()

    if (error) {
      console.error('Error creating document:', error)
      throw new Error('Failed to create document')
    }

    return document
  }

  async updateDocument(id: string, data: Partial<CreateDocumentData>): Promise<KnowledgeBaseDocument> {
    const { data: document, error } = await supabaseAdmin
      .from('knowledge_base_documents')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .single()

    if (error) {
      console.error('Error updating document:', error)
      throw new Error('Document not found or failed to update')
    }

    return document
  }

  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('knowledge_base_documents')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting document:', error)
      throw new Error('Failed to delete document')
    }
  }

  async searchDocuments(companyId: string, query: string): Promise<KnowledgeBaseDocument[]> {
    const { data: documents, error } = await supabaseAdmin
      .from('knowledge_base_documents')
      .select(`
        *,
        category:knowledge_base_categories(*)
      `)
      .eq('company_id', companyId)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error searching documents:', error)
      throw new Error('Failed to search documents')
    }

    return documents || []
  }
}

export const knowledgeBaseService = new KnowledgeBaseService()