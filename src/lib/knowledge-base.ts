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
  file_url?: string
  file_type: KnowledgeBaseDocument['file_type']
  file_size?: number
  company_id: string
}

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

// Demo storage for development
const demoCategories: KnowledgeBaseCategory[] = globalThis.__demoCategoriesStore || []
const demoDocuments: KnowledgeBaseDocument[] = globalThis.__demoDocumentsStore || []

// Persist demo data across hot reloads
globalThis.__demoCategoriesStore = demoCategories
globalThis.__demoDocumentsStore = demoDocuments

// Initialize default categories if empty
if (demoCategories.length === 0) {
  DEFAULT_CATEGORIES.forEach((category, index) => {
    demoCategories.push({
      id: `demo-category-${index + 1}`,
      company_id: 'demo-company-1',
      ...category,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  })
}

class KnowledgeBaseService {
  // Categories
  async getCategories(companyId: string): Promise<KnowledgeBaseCategory[]> {
    // In demo mode, return demo categories with document counts
    const categories = demoCategories.filter(cat => cat.company_id === companyId)
    
    // Add document counts
    return categories.map(category => ({
      ...category,
      document_count: demoDocuments.filter(doc => doc.category_id === category.id).length
    }))
  }

  async createCategory(data: CreateCategoryData): Promise<KnowledgeBaseCategory> {
    const category: KnowledgeBaseCategory = {
      id: `demo-category-${Date.now()}`,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    demoCategories.push(category)
    return category
  }

  async updateCategory(id: string, data: Partial<CreateCategoryData>): Promise<KnowledgeBaseCategory> {
    const categoryIndex = demoCategories.findIndex(cat => cat.id === id)
    if (categoryIndex === -1) {
      throw new Error('Category not found')
    }

    demoCategories[categoryIndex] = {
      ...demoCategories[categoryIndex],
      ...data,
      updated_at: new Date().toISOString()
    }

    return demoCategories[categoryIndex]
  }

  async deleteCategory(id: string): Promise<void> {
    // Delete all documents in this category first
    const documentsToDelete = demoDocuments.filter(doc => doc.category_id === id)
    documentsToDelete.forEach(doc => {
      const docIndex = demoDocuments.findIndex(d => d.id === doc.id)
      if (docIndex !== -1) {
        demoDocuments.splice(docIndex, 1)
      }
    })

    // Delete the category
    const categoryIndex = demoCategories.findIndex(cat => cat.id === id)
    if (categoryIndex !== -1) {
      demoCategories.splice(categoryIndex, 1)
    }
  }

  // Documents
  async getDocuments(companyId: string, categoryId?: string): Promise<KnowledgeBaseDocument[]> {
    let documents = demoDocuments.filter(doc => doc.company_id === companyId)
    
    if (categoryId) {
      documents = documents.filter(doc => doc.category_id === categoryId)
    }

    // Add category information
    return documents.map(doc => ({
      ...doc,
      category: demoCategories.find(cat => cat.id === doc.category_id)
    }))
  }

  async getDocument(id: string): Promise<KnowledgeBaseDocument | null> {
    const document = demoDocuments.find(doc => doc.id === id)
    if (!document) return null

    return {
      ...document,
      category: demoCategories.find(cat => cat.id === document.category_id)
    }
  }

  async createDocument(data: CreateDocumentData): Promise<KnowledgeBaseDocument> {
    const document: KnowledgeBaseDocument = {
      id: `demo-document-${Date.now()}`,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    demoDocuments.push(document)
    
    return {
      ...document,
      category: demoCategories.find(cat => cat.id === document.category_id)
    }
  }

  async updateDocument(id: string, data: Partial<CreateDocumentData>): Promise<KnowledgeBaseDocument> {
    const documentIndex = demoDocuments.findIndex(doc => doc.id === id)
    if (documentIndex === -1) {
      throw new Error('Document not found')
    }

    demoDocuments[documentIndex] = {
      ...demoDocuments[documentIndex],
      ...data,
      updated_at: new Date().toISOString()
    }

    return {
      ...demoDocuments[documentIndex],
      category: demoCategories.find(cat => cat.id === demoDocuments[documentIndex].category_id)
    }
  }

  async deleteDocument(id: string): Promise<void> {
    const documentIndex = demoDocuments.findIndex(doc => doc.id === id)
    if (documentIndex !== -1) {
      demoDocuments.splice(documentIndex, 1)
    }
  }

  async searchDocuments(companyId: string, query: string): Promise<KnowledgeBaseDocument[]> {
    const documents = demoDocuments.filter(doc => 
      doc.company_id === companyId &&
      (doc.title.toLowerCase().includes(query.toLowerCase()) ||
       doc.content.toLowerCase().includes(query.toLowerCase()))
    )

    return documents.map(doc => ({
      ...doc,
      category: demoCategories.find(cat => cat.id === doc.category_id)
    }))
  }
}

export const knowledgeBaseService = new KnowledgeBaseService()